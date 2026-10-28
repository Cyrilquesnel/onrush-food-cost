/** Integration QA of the immutable public Chrome ZIP. No SaaS or browser-profile imports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = path.join(ROOT, 'docs/extension/onrush-food-cost-1.0.0.zip');
const ZIP_SHA = 'c7d47ea4ea88861e3984857ce17b0b2328a3b89467d11e7727000831b4042c44';
const REPOSITORY = 'Cyrilquesnel/onrush-food-cost';
const options = new Map();
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  assert.ok(['--validate-only', '--self-test-policy', '--self-test-identity', '--chrome', '--output', '--expected-chrome-version'].includes(key), `Unknown option ${key}`);
  options.set(key, ['--validate-only', '--self-test-policy', '--self-test-identity'].includes(key) ? true : process.argv[++index]);
}
const output = path.resolve(options.get('--output') || path.join(ROOT, 'qa-artifacts'));
const report = { schema: 1, createdAt: new Date().toISOString(), repository: REPOSITORY,
  release: { version: '1.0.0', zip: 'docs/extension/onrush-food-cost-1.0.0.zip', sha256: ZIP_SHA },
  status: 'prepared', checks: [], gaps: [], notes: ['No Chrome Web Store submission or signed CRX installation is tested.'] };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const json = async (name, value) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const check = (name, details = {}) => report.checks.push({ name, status: 'passed', ...details });
async function until(operation, label, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await operation(); if (value) return value; } catch (error) { last = error; }
    await pause(150);
  }
  throw new Error(`Timeout: ${label}${last ? ` (${last.message})` : ''}`);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function unpack(directory) {
  const bytes = await readFile(ZIP);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256, ZIP_SHA, 'Only the immutable 1.0.0 release may be tested');
  const names = new Set();
  let offset = 0;
  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.ok(offset + 30 <= bytes.length, 'ZIP local header bounds');
    const flags = bytes.readUInt16LE(offset + 6), method = bytes.readUInt16LE(offset + 8);
    assert.equal(flags & 9, 0, 'No encrypted ZIP or deferred data descriptor');
    const checksum = bytes.readUInt32LE(offset + 14), compressedSize = bytes.readUInt32LE(offset + 18);
    const size = bytes.readUInt32LE(offset + 22), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    assert.ok(name && !name.includes('\\') && !name.includes('\0') && !name.includes(':') && !path.isAbsolute(name) && !name.split('/').includes('..'), 'ZIP path containment');
    assert.ok(!names.has(name), 'No duplicate ZIP path');
    names.add(name);
    const start = offset + 30 + nameLength + extraLength;
    assert.ok(start + compressedSize <= bytes.length && size < 5_000_000, 'ZIP data bounds');
    const compressed = bytes.subarray(start, start + compressedSize);
    assert.ok(method === 0 || method === 8, 'Supported ZIP compression');
    const data = method === 0 ? compressed : inflateRawSync(compressed);
    assert.equal(data.length, size, 'ZIP decompressed size');
    assert.equal(crc32(data), checksum, 'ZIP CRC32');
    if (directory) {
      const destination = path.join(directory, name);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, data);
    }
    offset = start + compressedSize;
  }
  assert.ok(names.size > 10 && bytes.readUInt32LE(offset) === 0x02014b50, 'ZIP central directory present');
  const manifestBytes = directory ? await readFile(path.join(directory, 'manifest.json'), 'utf8') : null;
  // Extract in memory too, so validate-only verifies the actual packaged manifest.
  let manifest = manifestBytes && JSON.parse(manifestBytes);
  if (!manifest) {
    const temporary = await mkdtemp(path.join(os.tmpdir(), 'onrush-zip-check-'));
    try { await unpack(temporary); manifest = JSON.parse(await readFile(path.join(temporary, 'manifest.json'), 'utf8')); }
    finally { await rm(temporary, { recursive: true, force: true }); }
  }
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.0');
  assert.equal(manifest.background.service_worker, 'background.js');
  for (const key of ['permissions', 'optional_permissions', 'host_permissions', 'optional_host_permissions', 'content_scripts', 'externally_connectable']) assert.equal(manifest[key], undefined, `${key} absent`);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
  assert.ok(manifest.action && !manifest.action.default_popup);
  const evidence = { sha256, bytes: bytes.length, entries: names.size, manifest, entryNames: [...names].sort() };
  await json('zip-validation.json', evidence);
  return evidence;
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.next = 0; this.pending = new Map(); this.listeners = new Map();
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id) {
        const pending = this.pending.get(data.id);
        if (pending) { this.pending.delete(data.id); clearTimeout(pending.timer); data.error ? pending.reject(new Error(`${pending.method}: ${data.error.message}`)) : pending.resolve(data.result); }
      } else for (const listener of this.listeners.get(data.method) || []) listener(data.params);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('DevTools connection closed')); }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return new CDP(socket);
  }
  on(method, listener) { const list = this.listeners.get(method) || []; list.push(listener); this.listeners.set(method, list); }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`DevTools timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer, method }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + (result.exceptionDetails.exception?.description || ''));
    return result.result.value;
  }
  close() { this.socket.close(); }
}
async function policyFiles() {
  const found = [];
  for (const root of ['/etc/opt/chrome/policies', '/etc/opt/chrome_for_testing/policies', '/etc/chromium/policies', '/etc/chromium-browser/policies']) {
    async function walk(directory) {
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.name.endsWith('.json')) found.push(full);
      }
    }
    await walk(root);
  }
  return found;
}
function unmanagedPolicyExport(value) {
  const dictionary = (entry, label) => {
    assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `${label} must be an explicit dictionary`);
    return entry;
  };
  dictionary(value, 'policy export');
  const groups = dictionary(value.policyGroups, 'policyGroups');
  assert.deepEqual(Object.keys(groups).sort(), ['chrome', 'extensionInstall', 'extensions', 'precedence'], 'Only the known Chrome 156 Linux policy groups are accepted');
  const chrome = dictionary(groups.chrome, 'policyGroups.chrome');
  const policies = dictionary(chrome.policies, 'policyGroups.chrome.policies');
  assert.deepEqual(Object.keys(policies), [], 'Browser must have no configured Chrome policies');
  const precedence = dictionary(groups.precedence, 'policyGroups.precedence');
  const precedencePolicies = dictionary(precedence.policies, 'policyGroups.precedence.policies');
  assert.deepEqual(Object.keys(precedencePolicies), [], 'No configured precedence policies');
  assert.ok(Array.isArray(precedence.precedenceOrder) && precedence.precedenceOrder.length === 4 && precedence.precedenceOrder.every(entry => typeof entry === 'string' && entry.trim()), 'Expected four precedence-order metadata labels');
  const extensions = dictionary(groups.extensions, 'policyGroups.extensions');
  assert.deepEqual(Object.keys(extensions), [], 'This release has no managed extension schema: no extension policy provider is expected');
  const install = dictionary(groups.extensionInstall, 'policyGroups.extensionInstall');
  assert.deepEqual(Object.keys(install).sort(), ['name', 'policies'], 'Exact extension installation provider shape required');
  assert.equal(install.name, 'Extension Install Policies', 'Exact extension installation provider name required');
  const installPolicies = dictionary(install.policies, 'policyGroups.extensionInstall.policies');
  assert.deepEqual(Object.keys(installPolicies), [], 'No configured extension installation policies');
  return { schema: 'Chrome 156 Linux policyGroups', configuredChromePolicyNames: [], configuredPrecedencePolicyNames: [], configuredExtensionPolicyGroups: [], configuredExtensionInstallPolicyNames: [], valuesRecorded: false };
}
async function policyContracts() {
  const { test } = await import('node:test');
  const fixture = () => ({ policyGroups: { chrome: { policies: {} }, precedence: { policies: {}, precedenceOrder: ['Platform machine', 'Cloud machine', 'Platform user', 'Cloud user'] }, extensions: {}, extensionInstall: { name: 'Extension Install Policies', policies: {} } } });
  test('policy export: explicit unmanaged Chrome 156 Linux schema passes', () => { assert.equal(unmanagedPolicyExport(fixture()).schema, 'Chrome 156 Linux policyGroups'); });
  test('policy export: old root chromePolicies is rejected', () => { assert.throws(() => unmanagedPolicyExport({ chromePolicies: {}, extensionPolicies: {} })); });
  test('policy export: obsolete policyValues spelling is rejected', () => { assert.throws(() => unmanagedPolicyExport({ policyValues: fixture().policyGroups })); });
  test('policy export: missing Chrome policies cannot imply an empty policy set', () => { const f = fixture(); delete f.policyGroups.chrome.policies; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: managed extension install block policy is refused', () => { const f = fixture(); f.policyGroups.chrome.policies.ExtensionInstallBlocklist = { value: ['*'], source: 'platform', level: 'mandatory' }; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: nonempty precedence policies are refused', () => { const f = fixture(); f.policyGroups.precedence.policies.CloudPolicyOverridesPlatformPolicy = { value: true }; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: unknown provider group is refused', () => { const f = fixture(); f.policyGroups.unknownProvider = { policies: {} }; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: extension policy providers are refused for this ZIP', () => { const f = fixture(); f.policyGroups.extensions.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa = { policies: {} }; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: missing extensions or Linux precedence group is refused', () => { for (const group of ['extensions', 'precedence']) { const f = fixture(); delete f.policyGroups[group]; assert.throws(() => unmanagedPolicyExport(f)); } });
  test('policy export: arrays/null cannot stand in for policy dictionaries', () => { for (const value of [[], null]) { const f = fixture(); f.policyGroups.chrome.policies = value; assert.throws(() => unmanagedPolicyExport(f)); } });
  test('policy export: missing or malformed precedence metadata is refused', () => { for (const value of [undefined, [], ['one'], ['one', 'two', 'three', '']]) { const f = fixture(); f.policyGroups.precedence.precedenceOrder = value; assert.throws(() => unmanagedPolicyExport(f)); } });
  test('policy export: extensionInstall is required and must be a dictionary', () => { const missing = fixture(); delete missing.policyGroups.extensionInstall; assert.throws(() => unmanagedPolicyExport(missing)); for (const value of [null, [], '', undefined]) { const f = fixture(); f.policyGroups.extensionInstall = value; assert.throws(() => unmanagedPolicyExport(f)); } });
  test('policy export: extensionInstall provider name is exact and required', () => { const missing = fixture(); delete missing.policyGroups.extensionInstall.name; assert.throws(() => unmanagedPolicyExport(missing)); const f = fixture(); f.policyGroups.extensionInstall.name = 'Other'; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: extensionInstall policies cannot be absent or an empty non-dictionary', () => { const missing = fixture(); delete missing.policyGroups.extensionInstall.policies; assert.throws(() => unmanagedPolicyExport(missing)); for (const value of [null, [], '', undefined]) { const f = fixture(); f.policyGroups.extensionInstall.policies = value; assert.throws(() => unmanagedPolicyExport(f)); } });
  test('policy export: configured extension installation policies are refused', () => { const f = fixture(); f.policyGroups.extensionInstall.policies.test = { value: 'blocked' }; assert.throws(() => unmanagedPolicyExport(f)); });
  test('policy export: unknown extensionInstall metadata is refused', () => { const f = fixture(); f.policyGroups.extensionInstall.unrecognized = {}; assert.throws(() => unmanagedPolicyExport(f)); });
}
function exactReleaseWorker(candidate, expected) {
  const manifest = candidate?.manifest;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return false;
  let workerUrl;
  try { workerUrl = new URL(candidate.workerUrl); } catch { return false; }
  return workerUrl.protocol === 'chrome-extension:' && /^[a-p]{32}$/.test(workerUrl.hostname)
    && candidate.id === workerUrl.hostname && workerUrl.pathname === '/' + expected.background.service_worker
    && manifest.name === expected.name && manifest.version === expected.version
    && manifest.manifest_version === expected.manifest_version
    && manifest.background?.service_worker === expected.background.service_worker
    && manifest.content_security_policy?.extension_pages === expected.content_security_policy.extension_pages;
}
async function identityContracts() {
  const { test } = await import('node:test');
  const expected = { name: 'Onrush — coût matière et food cost', version: '1.0.0', manifest_version: 3, background: { service_worker: 'background.js' }, content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" } };
  const fixture = () => ({ id: 'a'.repeat(32), workerUrl: `chrome-extension://${'a'.repeat(32)}/background.js`, manifest: structuredClone(expected) });
  test('worker identity: exact packaged identity is accepted', () => { assert.equal(exactReleaseWorker(fixture(), expected), true); });
  test('worker identity: a Chrome component with version 1.0 is rejected', () => { const c = fixture(); c.manifest.name = 'Browser component'; c.manifest.version = '1.0'; assert.equal(exactReleaseWorker(c, expected), false); });
  test('worker identity: getManifest version must preserve the exact ZIP version', () => { for (const version of ['1', '1.0', '1.0.0.0', '1.0.1', '1.1.0', '2.0.0', '', undefined]) { const c = fixture(); c.manifest.version = version; assert.equal(exactReleaseWorker(c, expected), false); } });
  test('worker identity: another manifest name is rejected', () => { const c = fixture(); c.manifest.name += ' other'; assert.equal(exactReleaseWorker(c, expected), false); });
  test('worker identity: altered CSP or manifest generation is rejected', () => { const c = fixture(); c.manifest.content_security_policy.extension_pages = "script-src 'self' 'unsafe-eval'"; assert.equal(exactReleaseWorker(c, expected), false); const old = fixture(); old.manifest.manifest_version = 2; assert.equal(exactReleaseWorker(old, expected), false); });
  test('worker identity: wrong worker path or inconsistent extension ID is rejected', () => { const c = fixture(); c.workerUrl = `chrome-extension://${c.id}/other.js`; assert.equal(exactReleaseWorker(c, expected), false); const other = fixture(); other.id = 'b'.repeat(32); assert.equal(exactReleaseWorker(other, expected), false); });
  test('worker identity: a missing manifest or a non-extension URL is rejected', () => { const c = fixture(); delete c.manifest; assert.equal(exactReleaseWorker(c, expected), false); const other = fixture(); other.workerUrl = 'https://example.invalid/background.js'; assert.equal(exactReleaseWorker(other, expected), false); });
}
async function screenshot(client, name) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(output, 'screenshots', name), Buffer.from(result.data, 'base64'));
}
async function diagnostics(client, stage) {
  const name = stage.replace(/[^a-z0-9-]/gi, '-');
  const evidence = { stage, at: new Date().toISOString(), inputValuesRecorded: false };
  try {
    evidence.dom = await client.evaluate(`(() => {
      const controls=[], shadowHosts=[], uniquePaths=new Set();let visited=0, skippedPolicyTrees=0, truncated=false;
      const text=value=>typeof value==='string'?value.slice(0,100):value;
      const visit=(root,chain=[],depth=0)=>{ if(depth>20||visited>=500){truncated=true;return;}for(const node of root.children||[]) {
        if(visited++>=500){truncated=true;return;}
        if(node.localName==='policy-table'||node.localName==='policy-row'){skippedPolicyTrees++;continue;}
        if(node.matches('button,cr-button,cr-icon-button,a,input,select,[role="button"],[role="dialog"]')) {
          if(controls.length<40){ const r=node.getBoundingClientRect(); controls.push({tag:node.localName,id:text(node.id),role:text(node.getAttribute('role')),label:text(node.getAttribute('aria-label')),buttonText:node.matches('button')?node.textContent.trim().slice(0,80):undefined,disabled:Boolean(node.disabled),visible:r.width>0&&r.height>0,shadowChain:chain}); }else truncated=true;
        }
        if(node.shadowRoot&&chain.length<8){ const host=node.localName+(node.id?'#'+text(node.id):'');const next=[...chain,host], key=next.join(' > ');if(!uniquePaths.has(key)){if(shadowHosts.length<30){uniquePaths.add(key);shadowHosts.push(next);}else truncated=true;}visit(node.shadowRoot,next,depth+1); }
        visit(node,chain,depth+1);
      }};
      visit(document);return {url:location.href,title:document.title,readyState:document.readyState,limits:{controls:40,uniqueShadowPaths:30,visitedElements:500,depth:20},visited,skippedPolicyTrees,truncated,shadowHosts,controls};
    })()`);
  } catch (error) { evidence.domError = error.message; }
  try { await screenshot(client, `diagnostic-${name}.png`); evidence.screenshot = `screenshots/diagnostic-${name}.png`; }
  catch (error) { evidence.screenshotError = error.message; }
  const file = `diagnostic-${name}.json`;
  await json(file, evidence);
  (report.diagnostics ||= []).push({ stage, file, screenshot: evidence.screenshot, controlCount: evidence.dom?.controls.length, uniqueShadowPathCount: evidence.dom?.shadowHosts.length, skippedPolicyTrees: evidence.dom?.skippedPolicyTrees, truncated: evidence.dom?.truncated, domError: evidence.domError, screenshotError: evidence.screenshotError });
}
async function clickPolicyControl(client, id) {
  assert.ok(['more-actions-button', 'export-policies'].includes(id), 'Only source-verified policy controls may be clicked');
  const point = await client.evaluate(`(() => {
    const root=document.querySelector('policy-app')?.shadowRoot;
    const element=${id === 'more-actions-button' ? "root?.querySelector('cr-button#more-actions-button')" : "root?.querySelector('cr-action-menu#actionMenu')?.querySelector('button#export-policies')"};
    if(!element)throw Error('Missing exact Chrome policy control');
    const r=element.getBoundingClientRect();if(!(r.width>0&&r.height>0))throw Error('Chrome policy control is not visible');
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function clickToolbarPin(client, extensionId) {
  const point = await client.evaluate(`(() => {
    const detail=document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-detail-view');
    if(detail?.data?.id!==${JSON.stringify(extensionId)})throw Error('Wrong extension details identity');
    const row=detail.shadowRoot?.querySelector('extensions-toggle-row#pin-to-toolbar');
    const toggle=row?.shadowRoot?.querySelector('cr-toggle#crToggle');
    if(!row||!toggle)throw Error('Missing exact toolbar pin UI control');
    row.scrollIntoView({block:'center'});const r=toggle.getBoundingClientRect();
    if(!(r.width>0&&r.height>0))throw Error('Toolbar pin UI control is not visible');
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function click(client, selector) {
  const point = await client.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw Error('Missing control'); element.scrollIntoView({block:'center'}); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
function csvRows(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ';' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  assert.equal(quoted, false, 'CSV quotes balanced');
  return rows;
}

let browserProcess, temporary, browser, page, activeClient, getTargets, browserLog = '';
const stage = name => { report.stage = name; };
async function main() {
await mkdir(output, { recursive: true });
await mkdir(path.join(output, 'screenshots'), { recursive: true });
try {
  stage('preflight');
  if (process.env.GITHUB_ACTIONS) {
    assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
    assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  }
  const zip = await unpack();
  check('immutable-zip-sha256-crc-manifest', { entries: zip.entries, sha256: zip.sha256 });
  if (options.get('--validate-only')) {
    report.status = 'static-validation-passed';
    report.gaps.push('Browser installation, native action, runtime CSP, download and offline reload have not run.');
  } else {
    assert.equal(process.platform, 'linux', 'The native toolbar procedure is Linux/X11 only');
    assert.ok(process.env.DISPLAY, 'Run headful under Xvfb, never on a user browser');
    assert.ok(options.get('--chrome') && options.get('--expected-chrome-version'), 'Explicit Chrome for Testing binary and pinned expected version required');
    const policies = await policyFiles();
    await json('policy-before.json', { checkedDirectories: ['/etc/opt/chrome/policies', '/etc/opt/chrome_for_testing/policies', '/etc/chromium/policies', '/etc/chromium-browser/policies'], jsonFiles: policies });
    assert.equal(policies.length, 0, 'Managed policy files exist: refuse to run; never disable or edit them');
    temporary = await mkdtemp(path.join(os.tmpdir(), 'onrush-extension-qa-'));
    const profile = path.join(temporary, 'profile'), extension = path.join(temporary, 'extension'), downloads = path.join(temporary, 'downloads');
    await mkdir(profile); await mkdir(extension); await mkdir(downloads);
    await unpack(extension);
    const executable = path.resolve(options.get('--chrome'));
    await access(executable, constants.X_OK);
    const versionText = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    assert.ok(versionText.includes('for Testing'), 'Require Chrome for Testing, not regular managed Chromium');
    assert.ok(versionText.endsWith(options.get('--expected-chrome-version')), 'Pinned Chrome version must match');
    report.browser = { versionText, executableSha256: createHash('sha256').update(await readFile(executable)).digest('hex'), temporaryProfile: true, flags: ['headful', 'fresh-profile', 'loopback-debugger', 'exact-unpacked-zip', 'sandbox-default'] };
    const args = [`--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--lang=en-US', '--window-size=1440,1000', `--load-extension=${extension}`, `--disable-extensions-except=${extension}`, 'about:blank'];
    stage('browser-launch');
    browserProcess = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    browserProcess.stderr.on('data', chunk => { browserLog += chunk.toString(); });
    const portText = await until(async () => {
      if (browserProcess.exitCode !== null) throw new Error(`Chrome exited ${browserProcess.exitCode}: ${browserLog.slice(-1200)}`);
      return readFile(path.join(profile, 'DevToolsActivePort'), 'utf8');
    }, 'Chrome loopback DevTools endpoint');
    const [port, browserPath] = portText.trim().split('\n');
    assert.match(port, /^\d+$/);
    const origin = `http://127.0.0.1:${port}`;
    browser = await CDP.connect(`ws://127.0.0.1:${port}${browserPath}`);
    const targets = async () => (await fetch(origin + '/json/list')).json();
    getTargets = targets;
    const attach = async target => CDP.connect(target.webSocketDebuggerUrl);
    const targetForId = async id => until(async () => (await targets()).find(target => target.id === id), 'new DevTools target');
    await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
    const seenCandidates = new Map();
    stage('worker-identity');
    const worker = await until(async () => {
      const matching = [];
      for (const target of (await targets()).filter(target => target.type === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(target.url))) {
        let candidateClient;
        try {
          candidateClient = await attach(target);
          const observed = await candidateClient.evaluate('({id:chrome.runtime.id,manifest:chrome.runtime.getManifest()})');
          const candidate = { ...observed, workerUrl: target.url };
          const matchesRelease = exactReleaseWorker(candidate, zip.manifest);
          seenCandidates.set(target.id, { targetId: target.id, extensionId: observed.id, workerUrl: target.url, name: observed.manifest.name, version: observed.manifest.version, manifestVersion: observed.manifest.manifest_version, serviceWorker: observed.manifest.background?.service_worker, csp: observed.manifest.content_security_policy?.extension_pages, matchesRelease });
          if (matchesRelease) matching.push(target);
        } catch (error) {
          seenCandidates.set(target.id, { targetId: target.id, workerUrl: target.url, probeError: error.message, matchesRelease: false });
        } finally { candidateClient?.close(); }
      }
      report.workerCandidates = [...seenCandidates.values()];
      await json('extension-candidates.json', { expected: { name: zip.manifest.name, version: zip.manifest.version, manifestVersion: zip.manifest.manifest_version, serviceWorker: zip.manifest.background.service_worker, csp: zip.manifest.content_security_policy.extension_pages }, candidates: report.workerCandidates });
      assert.ok(matching.length <= 1, 'Exactly one installed worker may match the release identity');
      return matching[0];
    }, 'service worker matching the exact packaged manifest identity');
    const workerClient = await attach(worker);
    const installed = await workerClient.evaluate('(async()=>({id:chrome.runtime.id,manifest:chrome.runtime.getManifest(),granted:await chrome.permissions.getAll()}))()');
    assert.equal(exactReleaseWorker({ ...installed, workerUrl: worker.url }, zip.manifest), true, 'Selected worker identity must remain exact');
    assert.equal(installed.manifest.version, '1.0.0');
    assert.equal(installed.manifest.name, zip.manifest.name);
    assert.equal(installed.manifest.content_security_policy.extension_pages, zip.manifest.content_security_policy.extension_pages);
    assert.deepEqual(installed.granted.permissions, [], 'No effective API permissions granted');
    assert.deepEqual(installed.granted.origins, [], 'No effective host permissions granted');
    report.extension = { id: installed.id, workerUrl: worker.url, version: installed.manifest.version, name: installed.manifest.name, grantedPermissions: installed.granted };
    workerClient.close();
    check('real-unpacked-installation-service-worker-target', { extension: report.extension });

    stage('policy-ui');
    const policyTarget = await browser.send('Target.createTarget', { url: 'chrome://policy/' });
    const policy = await attach(await targetForId(policyTarget.targetId));
    activeClient = policy;
    await diagnostics(policy, 'policy-created');
    await policy.evaluate("(async () => { await customElements.whenDefined('policy-app'); const app=document.querySelector('policy-app'); if(!app)throw Error('Missing policy-app'); await app.updateComplete; return true; })()");
    await until(() => policy.evaluate("document.readyState === 'complete' && Boolean(document.querySelector('policy-app')?.shadowRoot?.querySelector('cr-button#more-actions-button')) && Boolean(document.querySelector('policy-app')?.shadowRoot?.querySelector('cr-action-menu#actionMenu')?.querySelector('button#export-policies'))"), 'exact Chrome 156 policy-app shadow controls');
    await clickPolicyControl(policy, 'more-actions-button');
    await policy.evaluate("(async () => { const menu=document.querySelector('policy-app')?.shadowRoot?.querySelector('cr-action-menu#actionMenu'); if(!menu)throw Error('Missing exact policy actions menu'); await menu.updateComplete; return true; })()");
    await until(() => policy.evaluate("(() => { const menu=document.querySelector('policy-app')?.shadowRoot?.querySelector('cr-action-menu#actionMenu'); const e=menu?.querySelector('button#export-policies');if(!menu?.open||!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0; })()"), 'policy export button visible in the opened actions menu');
    await diagnostics(policy, 'policy-menu-open');
    stage('policy-export');
    await clickPolicyControl(policy, 'export-policies');
    const policyFilename = await until(async () => (await readdir(downloads)).find(name => name.endsWith('.json')), 'actual Chrome policy export');
    const policyExport = JSON.parse(await readFile(path.join(downloads, policyFilename), 'utf8'));
    const policyEvidence = unmanagedPolicyExport(policyExport);
    await json('policy-runtime.json', policyEvidence);
    await screenshot(policy, '01-policy.png');
    await rm(path.join(downloads, policyFilename));
    await browser.send('Target.closeTarget', { targetId: policyTarget.targetId }); policy.close();
    activeClient = undefined;
    check('runtime-browser-policy-export-empty');

    const calculatorUrl = `chrome-extension://${installed.id}/index.html`;
    stage('toolbar-pin-ui-setup');
    const detailsTarget = await browser.send('Target.createTarget', { url: `chrome://extensions/?id=${installed.id}` });
    const details = await attach(await targetForId(detailsTarget.targetId));
    activeClient = details;
    await details.evaluate("(async () => { await customElements.whenDefined('extensions-manager'); const manager=document.querySelector('extensions-manager'); if(!manager)throw Error('Missing extensions-manager'); await manager.updateComplete; return true; })()");
    await until(() => details.evaluate(`document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-detail-view')?.data?.id===${JSON.stringify(installed.id)}`), 'details view for the exact installed extension');
    await details.evaluate("(async () => { const detail=document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-detail-view'); await detail.updateComplete; const row=detail.shadowRoot.querySelector('extensions-toggle-row#pin-to-toolbar'); if(!row)throw Error('Missing pin-to-toolbar row'); await row.updateComplete; return true; })()");
    const pinState = () => details.evaluate("(() => { const detail=document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-detail-view'); const row=detail?.shadowRoot?.querySelector('extensions-toggle-row#pin-to-toolbar'); return {id:detail?.data?.id,checked:row?.checked,pinnedToToolbar:detail?.data?.pinnedToToolbar}; })()");
    const beforePin = await pinState();
    assert.equal(beforePin.id, installed.id); assert.equal(typeof beforePin.checked, 'boolean');
    await diagnostics(details, 'toolbar-pin-before');
    if (!beforePin.checked) await clickToolbarPin(details, installed.id);
    const afterPin = await until(async () => { const state = await pinState(); return state.id === installed.id && state.checked === true && state.pinnedToToolbar === true && state; }, 'real toolbar pin setting confirmed by the details view');
    check('toolbar-pin-ui-setup-only', { extensionId: installed.id, before: beforePin, after: afterPin, actionActivated: false });
    await diagnostics(details, 'toolbar-pin-after');
    await browser.send('Target.closeTarget', { targetId: detailsTarget.targetId }); details.close(); activeClient = undefined;

    stage('native-action');
    const beforeActionTargets = new Set((await targets()).map(target => target.id));
    assert.equal((await targets()).some(target => target.type === 'page' && target.url === calculatorUrl), false, 'Pin setup must not have opened the calculator');
    const action = { method: 'X11 native keyboard via xdotool', pinnedViaUi: true, syntheticChromeApiEvent: false, attempts: [], success: false };
    // Real browser UI events only. Never invoke chrome.action listeners through DevTools.
    const windowIds = execFileSync('xdotool', ['search', '--onlyvisible', '--pid', String(browserProcess.pid)], { encoding: 'utf8', timeout: 5000 }).trim().split(/\s+/);
    assert.ok(windowIds[0], 'Native browser window found');
    execFileSync('xdotool', ['windowfocus', '--sync', windowIds[0]], { timeout: 5000 });
    execFileSync('scrot', [path.join(output, 'screenshots', '02-native-before.png')], { timeout: 5000 });
    let calculatorTarget;
    for (let tabs = 0; tabs <= 10 && !calculatorTarget; tabs++) {
      const keys = ['Escape', 'Escape', 'alt+shift+t', ...Array(tabs).fill('Tab'), 'space'];
      execFileSync('xdotool', ['key', '--clearmodifiers', ...keys], { timeout: 5000 });
      await pause(250);
      calculatorTarget = (await targets()).find(target => target.type === 'page' && target.url === calculatorUrl && !beforeActionTargets.has(target.id));
      let menuKeys = [];
      if (!calculatorTarget) {
        menuKeys = ['Down', 'Return'];
        execFileSync('xdotool', ['key', '--clearmodifiers', ...menuKeys], { timeout: 5000 });
        await pause(350);
        calculatorTarget = (await targets()).find(target => target.type === 'page' && target.url === calculatorUrl && !beforeActionTargets.has(target.id));
      }
      action.attempts.push({ tabs, keys, menuKeys, openedExtensionTarget: Boolean(calculatorTarget), at: new Date().toISOString() });
    }
    action.success = Boolean(calculatorTarget);
    if (action.success) check('native-browser-action-opens-extension-owned-tab', { targetUrl: calculatorTarget.url, newTargetId: calculatorTarget.id, activation: 'X11 toolbar keyboard after UI pin setup' });
    else {
      report.gaps.push('Native toolbar/action activation was not automated successfully. Direct extension navigation below is not an action test.');
      const direct = await browser.send('Target.createTarget', { url: calculatorUrl });
      calculatorTarget = await targetForId(direct.targetId);
    }
    await json('native-action.json', action);
    execFileSync('scrot', [path.join(output, 'screenshots', '03-native-after.png')], { timeout: 5000 });
    page = await attach(calculatorTarget);
    activeClient = page;
    stage('calculator-online');
    const unexpectedErrors = [], externalRequests = [];
    page.on('Runtime.exceptionThrown', event => unexpectedErrors.push(event.exceptionDetails.text));
    page.on('Network.requestWillBeSent', event => { if (/^https?:/.test(event.request.url)) externalRequests.push(event.request.url); });
    let loadEvents = 0;
    page.on('Page.loadEventFired', () => { loadEvents++; });
    await page.send('Runtime.enable'); await page.send('Page.enable'); await page.send('Network.enable');
    await page.send('Page.reload', { ignoreCache: true });
    await until(async () => loadEvents > 0 && await page.evaluate("document.readyState === 'complete' && document.querySelector('#portion-cost')?.textContent.includes('2,50')"), 'observed packaged calculator reload');
    await page.evaluate(`(() => {
      const set = (selector,value) => { const field=document.querySelector(selector); field.value=value; field.dispatchEvent(new Event('input',{bubbles:true})); };
      set('#recipe-name','=1+1'); set('#portions','2'); set('#sale-price','10.0');
      set('[data-key="name"]','+QA'); set('[data-key="price"]','10,0'); set('[data-key="quantity"]','600'); set('[data-key="yield"]','80');
    })()`);
    assert.equal(await page.evaluate("document.querySelector('#results-content').hidden"), true, 'Changed inputs invalidate the seed result');
    await click(page, 'button[type="submit"]');
    const known = await page.evaluate("({url:location.href,portion:document.querySelector('#portion-cost').textContent,total:document.querySelector('#recipe-cost').textContent,foodCost:document.querySelector('#food-cost').textContent,margin:document.querySelector('#material-margin').textContent,source:new URL(document.querySelector('#onrush-resource').href).searchParams.get('utm_source'),error:!document.querySelector('#error-summary').hidden})");
    assert.equal(known.url, calculatorUrl); assert.equal(known.portion, '3,75 €'); assert.equal(known.total, '7,50 € HT'); assert.equal(known.foodCost, '37,5 %'); assert.equal(known.margin, '6,25 €'); assert.equal(known.source, 'chrome_extension'); assert.equal(known.error, false);
    assert.equal(await page.evaluate("document.querySelector('#results-content').hidden"), false, 'Submission renders the changed calculation');
    check('installed-extension-ui-known-calculation-comma-and-dot', known);
    await screenshot(page, '04-calculation.png');
    stage('csv-online');
    await click(page, '#export-csv');
    const csvName = await until(async () => (await readdir(downloads)).find(name => name.endsWith('.csv')), 'real CSV file download');
    const csv = await readFile(path.join(downloads, csvName), 'utf8'), rows = csvRows(csv);
    const value = label => rows.find(row => row[0] === 'Résultat' && row[1] === label)?.[7];
    assert.equal(csv.charCodeAt(0), 0xfeff); assert.equal(value('Coût matière par portion'), '3,750000'); assert.equal(value('Coût matière recette'), '7,500000'); assert.equal(value('Food cost'), '37,500000'); assert.equal(value('Marge matière par portion'), '6,250000');
    assert.ok(rows.some(row => row[0] === 'Métadonnée' && row[1] === "'=1+1"));
    assert.ok(rows.some(row => row[0] === 'Ingrédient' && row[1] === "'+QA"));
    await writeFile(path.join(output, 'export.csv'), csv);
    // Browser.setDownloadBehavior(allow) may reuse a filename. Keep the evidence,
    // then remove only this completed download inside the disposable directory.
    await rm(path.join(downloads, csvName));
    check('real-csv-download-numeric-values-and-formula-protection', { filename: csvName, archivedAs: 'export.csv', temporaryDownloadRemoved: true, bytes: Buffer.byteLength(csv), sha256: createHash('sha256').update(csv).digest('hex') });

    stage('offline-reload');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    const beforeOfflineReload = loadEvents;
    await page.send('Page.reload', { ignoreCache: true });
    await until(async () => loadEvents > beforeOfflineReload && await page.evaluate("document.readyState === 'complete' && document.querySelector('#portion-cost')?.textContent === '2,50 €' && document.querySelector('#version')?.textContent === '1.0.0'"), 'actual offline extension reload');
    const offlineSeed = await page.evaluate("({url:location.href,online:navigator.onLine,navigationType:performance.getEntriesByType('navigation')[0]?.type,portion:document.querySelector('#portion-cost').textContent,foodCost:document.querySelector('#food-cost').textContent})");
    assert.equal(offlineSeed.online, false); assert.equal(offlineSeed.navigationType, 'reload'); assert.equal(offlineSeed.url, calculatorUrl); assert.equal(offlineSeed.foodCost, '25,0 %');
    stage('offline-recalculation');
    await page.evaluate("(() => { const field=document.querySelector('#portions'); field.value='6'; field.dispatchEvent(new Event('input',{bubbles:true})); })()");
    assert.equal(await page.evaluate("document.querySelector('#results-content').hidden"), true, 'Offline input change invalidates the reloaded seed');
    await click(page, 'button[type="submit"]');
    const offline = await page.evaluate("({portion:document.querySelector('#portion-cost').textContent,foodCost:document.querySelector('#food-cost').textContent,margin:document.querySelector('#material-margin').textContent,hidden:document.querySelector('#results-content').hidden})");
    assert.equal(offline.portion, '1,25 €'); assert.equal(offline.foodCost, '12,5 %'); assert.equal(offline.margin, '8,75 €'); assert.equal(offline.hidden, false);
    assert.notEqual(offline.portion, offlineSeed.portion, 'Offline recalculation changes the result after a real reload');
    await screenshot(page, '05-offline-reload.png');
    check('offline-hard-reload-and-changed-recalculation', { cacheDisabled: true, ignoreCache: true, networkOffline: true, reloadedSeed: offlineSeed, recalculated: offline });
    stage('csv-offline');
    const existingDownloads = new Set(await readdir(downloads));
    await click(page, '#export-csv');
    const offlineCsvName = await until(async () => (await readdir(downloads)).find(name => name.endsWith('.csv') && !existingDownloads.has(name)), 'real offline CSV download after recalculation');
    const offlineCsv = await readFile(path.join(downloads, offlineCsvName), 'utf8'), offlineRows = csvRows(offlineCsv);
    const offlineValue = label => offlineRows.find(row => row[0] === 'Résultat' && row[1] === label)?.[7];
    assert.equal(offlineValue('Coût matière par portion'), '1,250000'); assert.equal(offlineValue('Coût matière recette'), '7,500000'); assert.equal(offlineValue('Food cost'), '12,500000'); assert.equal(offlineValue('Marge matière par portion'), '8,750000');
    await writeFile(path.join(output, 'offline-export.csv'), offlineCsv);
    check('real-offline-csv-download-reflects-changed-calculation', { filename: offlineCsvName, bytes: Buffer.byteLength(offlineCsv), sha256: createHash('sha256').update(offlineCsv).digest('hex') });
    assert.deepEqual(externalRequests, [], 'Calculator makes no HTTP(S) requests');
    assert.deepEqual(unexpectedErrors, [], 'No unhandled runtime exceptions');
    check('no-calculator-http-requests-or-runtime-exceptions');

    stage('runtime-csp');
    const csp = await page.evaluate(`new Promise(resolve => {
      const violations=[]; const listener=e=>violations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI});
      document.addEventListener('securitypolicyviolation',listener);
      const script=document.createElement('script'); script.textContent='globalThis.__qaInlineExecuted=true'; document.head.append(script);
      setTimeout(()=>{script.remove();document.removeEventListener('securitypolicyviolation',listener);resolve({inlineExecuted:globalThis.__qaInlineExecuted===true,violations});},300);
    })`);
    assert.equal(csp.inlineExecuted, false);
    assert.ok(csp.violations.some(item => item.directive.startsWith('script-src') && item.blockedURI === 'inline'), 'Browser CSP blocks an actual inserted inline script');
    check('runtime-extension-csp-blocks-inline-script', csp);
    report.status = report.gaps.length ? 'incomplete' : 'passed';
  }
} catch (error) {
  report.status = 'failed'; report.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  if (browser) {
    try {
      if (!activeClient && getTargets) {
        const target = (await getTargets()).find(target => target.type === 'page' && target.webSocketDebuggerUrl);
        if (target) activeClient = await CDP.connect(target.webSocketDebuggerUrl);
      }
      if (activeClient) await diagnostics(activeClient, 'finally-' + (report.stage || 'unknown'));
    } catch (error) { report.finalDiagnosticError = error.message; }
  }
  if (browserProcess && process.env.DISPLAY) {
    try { execFileSync('scrot', [path.join(output, 'screenshots', 'diagnostic-final-native.png')], { timeout: 5000 }); }
    catch (error) { report.finalNativeScreenshotError = error.message; }
  }
  if (browserProcess) await writeFile(path.join(output, 'browser.log'), browserLog);
  if (browser) { try { await browser.send('Browser.close'); } catch { /* The process may already have exited. */ } }
  activeClient?.close(); if (page !== activeClient) page?.close(); browser?.close();
  if (browserProcess && browserProcess.exitCode === null) { browserProcess.kill('SIGTERM'); await pause(300); if (browserProcess.exitCode === null) browserProcess.kill('SIGKILL'); }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  report.completedAt = new Date().toISOString();
  await json('report.json', report);
  console.log('QA_REPORT ' + JSON.stringify(report));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, gaps: report.gaps, error: report.error || null }));
  if (report.status === 'incomplete') process.exitCode = 1;
}
}
if (options.get('--self-test-policy')) await policyContracts();
else if (options.get('--self-test-identity')) await identityContracts();
else await main();
