import 'server-only';
import { getSupabase } from './supabase-server';
import { OFFER_ID, PHOTO_BUCKET, parsePhoto, photoPath } from './photo-check.mjs';

export const PHOTO_SETUP = 'Run database/018_card_photos.sql in Supabase first.';
const setupProblem = (error) => /photo_path|bucket|not found/i.test(`${error?.message} ${error?.error ?? ''} ${error?.details ?? ''}`);

// Keeps the photo of the card with its offer. Returns { error } and never throws:
// an offer is still saved if its photo cannot be.
export async function savePhoto(offerId, dataUrl) {
  if (!OFFER_ID.test(String(offerId))) return { error: 'This offer could not be found.' };
  const photo = parsePhoto(dataUrl);
  if (!photo.ok) return { error: photo.reason === 'none' ? null : photo.reason, skipped: true };
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  try {
    const { data: before } = await supabase.from('card_offers').select('photo_path').eq('id', offerId).maybeSingle();
    const path = photoPath(offerId, photo.ext);
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.bytes, { contentType: photo.type, upsert: true });
    if (upErr) {
      console.error('savePhoto upload failed:', upErr);
      return { error: setupProblem(upErr) ? PHOTO_SETUP : 'The photo was not saved. Try again.' };
    }
    const { error } = await supabase.from('card_offers').update({ photo_path: path }).eq('id', offerId);
    if (error) {
      console.error('savePhoto update failed:', error);
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      return { error: setupProblem(error) ? PHOTO_SETUP : 'The photo was not saved. Try again.' };
    }
    // A replaced photo is removed so only one is kept per offer.
    if (before?.photo_path && before.photo_path !== path) await supabase.storage.from(PHOTO_BUCKET).remove([before.photo_path]);
    return { error: null, path };
  } catch (e) {
    console.error('savePhoto failed:', e);
    return { error: 'The photo was not saved. Try again.' };
  }
}

// The stored photo for an offer, or null.
export async function readPhoto(offerId) {
  if (!OFFER_ID.test(String(offerId))) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: offer, error } = await supabase.from('card_offers').select('photo_path').eq('id', offerId).maybeSingle();
  if (error || !offer?.photo_path) return null;
  const { data, error: dlErr } = await supabase.storage.from(PHOTO_BUCKET).download(offer.photo_path);
  if (dlErr || !data) return null;
  return { bytes: Buffer.from(await data.arrayBuffer()), type: data.type || 'image/jpeg' };
}
