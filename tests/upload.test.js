import {test} from 'node:test';
import assert from 'node:assert/strict';
import {convertFile, mediaKind, convertedName} from '../scripts/converter.js';
import {oggPage, crc32} from '../scripts/ogg.js';
globalThis.Hooks = {once() {}};
const {wrapUpload} = await import('../scripts/main.js');
globalThis.game = {settings: {get: (_, k) => ({enabled: true, quality: .85, bitrate: 128, maxSize: 100})[k]}, i18n: {has: () => false, localize: x => x, format: x => x}};
globalThis.ui = {notifications: {error() {}}};
test('classifies media and names', () => {
  assert.equal(mediaKind({name: 'a.JPG', type: ''}), 'image');
  assert.equal(mediaKind({name: 'a.mp3', type: ''}), 'audio');
  assert.equal(mediaKind({name: 'a.webp', type: ''}), null);
  assert.equal(convertedName('map.v2.png', 'webp'), 'map.v2.webp');
});
test('only converted file reaches upload with preserved arguments and response', async () => {
  const original = new File(['x'], 'a.png'), converted = new File(['y'], 'a.webp');
  const receiver = {}, body = {bucket: 'test'}, options = {notify: false}, response = {path: 'a.webp'};
  const upload = wrapUpload(function(...args) { assert.equal(this, receiver); assert.deepEqual(args, ['s3', 'folder', converted, body, options]); return response; }, async () => converted);
  assert.equal(await upload.call(receiver, 's3', 'folder', original, body, options), response);
});
test('conversion failure blocks original', async () => {
  let calls = 0;
  const upload = wrapUpload(() => {calls++;}, async () => {throw new Error('sizeLimit');});
  await assert.rejects(upload('data', '', new File(['x'], 'a.png')), /sizeLimit/);
  assert.equal(calls, 0);
});
test('upload failure does not retry', async () => {
  let calls = 0;
  const upload = wrapUpload(() => {calls++; throw new Error('network');}, async f => f);
  await assert.rejects(upload('data', '', new File(['x'], 'a.png')), /network/);
  assert.equal(calls, 1);
});
test('converted files pass through and size limits block media', async () => {
  const f = new File(['x'], 'a.ogg');
  assert.equal(await convertFile(f), f);
  await assert.rejects(convertFile(new File(['x'], 'a.png'), {maxSize: 0}), /sizeLimit/);
});
test('Ogg CRC, lacing and granule', () => {
  const p = oggPage(new Uint8Array(255), {serial: 12, sequence: 2, granule: 960});
  assert.deepEqual([...p.subarray(26, 29)], [2, 255, 0]);
  const v = new DataView(p.buffer), crc = v.getUint32(22, true);
  assert.equal(v.getBigUint64(6, true), 960n);
  v.setUint32(22, 0, true); assert.equal(crc32(p), crc);
});
