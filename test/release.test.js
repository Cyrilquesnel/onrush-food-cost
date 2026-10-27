import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build : moteur identique web/Chrome, aucune permission, ZIP reproductible', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const first = readFileSync(path.join(root, 'dist/chrome-extension.zip'));
  const manifest = JSON.parse(readFileSync(path.join(root, 'dist/chrome-extension/manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined); assert.equal(manifest.content_scripts, undefined);
  for (const entry of ['engine.js', 'csv.js', 'app.js']) assert.deepEqual(readFileSync(path.join(root, 'dist/site', entry)), readFileSync(path.join(root, 'dist/chrome-extension', entry)));
  for (const size of [16, 48, 128]) assert.ok(existsSync(path.join(root, `dist/chrome-extension/icons/${size}.png`)));
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  assert.deepEqual(readFileSync(path.join(root, 'dist/chrome-extension.zip')), first);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.ok(readFileSync(path.join(root, 'dist/SHA256SUMS.txt'), 'utf8').includes(createHash('sha256').update(first).digest('hex')));
});
