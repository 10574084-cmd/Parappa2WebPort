import test from 'node:test';
import assert from 'node:assert/strict';
import { Iso9660Image, formatBytes } from '../src/iso9660.js';

function putAscii(bytes, offset, value, length) {
  const encoded = new TextEncoder().encode(value);
  bytes.set(encoded.subarray(0, length), offset);
}
function putBothEndian32(view, offset, value) {
  view.setUint32(offset, value, true);
  view.setUint32(offset + 4, value, false);
}
function record(extent, size, flags, identifier) {
  const id = typeof identifier === 'number' ? new Uint8Array([identifier]) : new TextEncoder().encode(identifier);
  const length = 33 + id.length + (id.length % 2 === 0 ? 1 : 0);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, length);
  putBothEndian32(view, 2, extent);
  putBothEndian32(view, 10, size);
  view.setUint8(25, flags);
  view.setUint16(28, 1, true);
  view.setUint16(30, 1, false);
  view.setUint8(32, id.length);
  bytes.set(id, 33);
  return bytes;
}
function makeIso() {
  const bytes = new Uint8Array(32 * 2048);
  const view = new DataView(bytes.buffer);
  const pvd = 16 * 2048;
  bytes[pvd] = 1;
  putAscii(bytes, pvd + 1, 'CD001', 5);
  bytes[pvd + 6] = 1;
  putAscii(bytes, pvd + 8, 'TEST SYSTEM', 32);
  putAscii(bytes, pvd + 40, 'TEST DISC', 32);
  view.setUint16(pvd + 128, 2048, true);
  view.setUint16(pvd + 130, 2048, false);
  bytes.set(record(20, 2048, 2, 0), pvd + 156);
  const term = 17 * 2048;
  bytes[term] = 255;
  putAscii(bytes, term + 1, 'CD001', 5);
  bytes[term + 6] = 1;

  let cursor = 20 * 2048;
  for (const item of [
    record(20, 2048, 2, 0),
    record(20, 2048, 2, 1),
    record(21, 2048, 2, 'LEVEL1'),
    record(22, 11, 0, 'README.TXT;1')
  ]) { bytes.set(item, cursor); cursor += item.length; }

  cursor = 21 * 2048;
  for (const item of [
    record(21, 2048, 2, 0),
    record(20, 2048, 2, 1),
    record(23, 6, 0, 'STAGE.OLM;1')
  ]) { bytes.set(item, cursor); cursor += item.length; }

  putAscii(bytes, 22 * 2048, 'Hello world', 11);
  putAscii(bytes, 23 * 2048, 'MODULE', 6);
  return bytes.buffer;
}

test('reads volume metadata and recursively lists folders and files', () => {
  const image = new Iso9660Image(makeIso());
  const summary = image.summary();
  assert.equal(summary.volumeId, 'TEST DISC');
  assert.equal(summary.systemId, 'TEST SYSTEM');
  assert.equal(summary.sectorSize, 2048);
  assert.equal(summary.files, 2);
  assert.equal(summary.directories, 1);
  assert.ok(image.entries.some(entry => entry.path === 'LEVEL1/STAGE.OLM'));
});

test('previews only the requested file header bytes', () => {
  const image = new Iso9660Image(makeIso());
  const entry = image.entries.find(item => item.name === 'README.TXT');
  assert.equal(new TextDecoder().decode(image.readHeader(entry)), 'Hello world');
});

test('rejects non-ISO data', () => {
  assert.throws(() => new Iso9660Image(new ArrayBuffer(32 * 2048)), /descriptor primario ISO 9660/);
});

test('formats file sizes', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
});
