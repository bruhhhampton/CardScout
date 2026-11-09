// Checks a card photo sent from the phone before it is stored. Plain code, no storage.
export const PHOTO_BUCKET = 'card-photos';
export const MAX_PHOTO_BYTES = 1_500_000;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// dataUrl is what the phone sends: "data:image/jpeg;base64,...". Returns the bytes or why not.
export function parsePhoto(dataUrl) {
  const s = typeof dataUrl === 'string' ? dataUrl : '';
  if (!s) return { ok: false, reason: 'none' };
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(s);
  if (!m) return { ok: false, reason: 'That file is not a photo CardScout can keep (JPEG, PNG or WebP).' };
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length < 200) return { ok: false, reason: 'That photo is empty.' };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, reason: 'That photo is too large. Take it again.' };
  return { ok: true, type: m[1], ext: TYPES[m[1]], bytes };
}

// Where an offer's photo is kept. The time makes each new photo a new file, so phones never show an old one.
export const photoPath = (offerId, ext, now = Date.now()) => `${offerId}/${now}.${ext}`;
export const OFFER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
