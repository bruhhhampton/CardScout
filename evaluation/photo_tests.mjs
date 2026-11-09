// Run: node evaluation/photo_tests.mjs
// Card photos: what the server accepts before storing, and where a photo is kept.
import assert from 'node:assert/strict';
import { MAX_PHOTO_BYTES, OFFER_ID, parsePhoto, photoPath } from '../lib/photo-check.mjs';

const b64 = (n) => Buffer.alloc(n, 7).toString('base64');
const jpeg = `data:image/jpeg;base64,${b64(5000)}`;

// A normal phone photo
let p = parsePhoto(jpeg);
assert.equal(p.ok, true);
assert.equal(p.type, 'image/jpeg');
assert.equal(p.ext, 'jpg');
assert.equal(p.bytes.length, 5000);
assert.equal(parsePhoto(`data:image/png;base64,${b64(900)}`).ext, 'png');
assert.equal(parsePhoto(`data:image/webp;base64,${b64(900)}`).ext, 'webp');

// No photo is not an error: typed-in offers have none.
for (const none of ['', null, undefined, 42]) assert.deepEqual(parsePhoto(none), { ok: false, reason: 'none' });

// Anything that is not a plain JPEG, PNG or WebP photo is refused.
for (const bad of [
  'data:image/svg+xml;base64,' + b64(900),            // could carry a script
  'data:text/html;base64,' + b64(900),
  'data:image/jpeg;base64,not base64!',
  'https://example.com/card.jpg',
  `data:image/jpeg;base64,${b64(900)}" onload="x`,
]) {
  const r = parsePhoto(bad);
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a photo/);
}
assert.match(parsePhoto(`data:image/jpeg;base64,${b64(50)}`).reason, /empty/);
assert.match(parsePhoto(`data:image/jpeg;base64,${b64(MAX_PHOTO_BYTES + 1)}`).reason, /too large/);
assert.equal(parsePhoto(`data:image/jpeg;base64,${b64(MAX_PHOTO_BYTES)}`).ok, true);

// Where it is kept: under the offer's own id, a new file each time.
const id = '11111111-1111-4111-8111-111111111111';
assert.equal(photoPath(id, 'jpg', 1000), `${id}/1000.jpg`);
assert.notEqual(photoPath(id, 'jpg', 1000), photoPath(id, 'jpg', 1001));
assert.ok(OFFER_ID.test(id));
for (const bad of ['', '../secrets', `${id}/..`, 'abc', `${id} `]) assert.ok(!OFFER_ID.test(bad), `rejects ${JSON.stringify(bad)}`);

console.log('Photo tests passed.');
