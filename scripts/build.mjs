import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, crc]);
}
function icon(size) {
  const pixels = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5) / size - .5, dy = (y + .5) / size - .5;
    const ring = dx * dx + dy * dy < .29 ** 2 && dx * dx + dy * dy > .15 ** 2;
    const dot = dx > .23 && dx < .34 && dy > .2 && dy < .31;
    const rgba = ring || dot ? [233, 255, 141, 255] : [23, 60, 50, 255];
    const offset = y * (1 + size * 4) + 1 + x * 4;
    for (let i = 0; i < 4; i++) pixels[offset + i] = rgba[i];
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
}
async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) result.push({ name: relative, data: await readFile(path.join(directory, entry.name)) });
    else throw new Error('No symlinks in the release artifact.');
  }
  return result;
}
function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8'), checksum = crc32(file.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(0, 8); header.writeUInt16LE(0, 10); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(file.data.length, 18); header.writeUInt32LE(file.data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, file.data);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(0, 10); entry.writeUInt16LE(0, 12); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(checksum, 16); entry.writeUInt32LE(file.data.length, 20); entry.writeUInt32LE(file.data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name); offset += header.length + name.length + file.data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

await rm(dist, { recursive: true, force: true });
const site = path.join(dist, 'site'), extension = path.join(dist, 'chrome-extension');
await mkdir(site, { recursive: true }); await mkdir(extension, { recursive: true });
for (const target of [site, extension]) {
  for (const entry of await readdir(path.join(root, 'site'))) await copyFile(path.join(root, 'site', entry), path.join(target, entry));
  for (const entry of ['engine.js', 'csv.js']) await copyFile(path.join(root, 'src', entry), path.join(target, entry));
  for (const entry of ['README.md', 'LICENSE', 'PRIVACY.md', 'THIRD-PARTY-NOTICES.md']) await copyFile(path.join(root, entry), path.join(target, entry));
}
await writeFile(path.join(site, '.nojekyll'), '');
for (const entry of ['manifest.json', 'background.js']) await copyFile(path.join(root, 'extension', entry), path.join(extension, entry));
await mkdir(path.join(extension, 'icons'));
for (const size of [16, 48, 128]) await writeFile(path.join(extension, 'icons', `${size}.png`), icon(size));
const extensionZip = zip(await filesUnder(extension));
await writeFile(path.join(dist, 'chrome-extension.zip'), extensionZip);
const siteZip = zip(await filesUnder(site));
await writeFile(path.join(dist, 'site.zip'), siteZip);
const checksums = [['chrome-extension.zip', extensionZip], ['site.zip', siteZip]].map(([name, bytes]) => `${createHash('sha256').update(bytes).digest('hex')}  ${name}`).join('\n') + '\n';
await writeFile(path.join(dist, 'SHA256SUMS.txt'), checksums);
console.log('Built dist/site, dist/site.zip, dist/chrome-extension and reproducible dist/chrome-extension.zip.');
console.log(checksums.trim());
