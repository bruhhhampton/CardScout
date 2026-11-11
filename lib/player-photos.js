import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabase } from './supabase-server';
import { isApiPhotoUrl, MAX_PLAYER_PHOTO, needsLookup, pickProfile, PLAYER_PHOTO_BUCKET, searchTerms } from './player-photo-match.mjs';

// Player photos from API-Football (12 Nov 2026). The team checked API-Football's terms first.
// One lookup per player, saved in player_photos, so the free plan's 100 requests a day go a long way.
// Nothing here ever throws: a player page always loads, with or without a photo.

const API = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const ID = /^[A-Za-z0-9_-]{1,40}$/;

async function apiSearch(term, key) {
  const res = await fetch(`${API}/players/profiles?search=${encodeURIComponent(term)}`, {
    headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(6000), cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  const errs = body?.errors && (Array.isArray(body.errors) ? body.errors : Object.values(body.errors));
  // A limit or key problem means "try again later", so nothing is saved for this player.
  if (!res.ok || errs?.length) throw new Error(`API-Football: ${errs?.join('; ') || res.status}`);
  return (body.response ?? []).map((x) => x.player).filter(Boolean);
}

async function fetchImage(url) {
  if (!isApiPhotoUrl(url)) return null;
  // Tests point this at a stand-in server; in real use it is unset and the API-Football address is used as given.
  const from = process.env.API_FOOTBALL_MEDIA_BASE_URL ? url.replace('https://media.api-sports.io', process.env.API_FOOTBALL_MEDIA_BASE_URL) : url;
  const res = await fetch(from, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!res.ok || !/^image\/(png|jpeg|webp)$/.test(type)) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PLAYER_PHOTO) return null;
  return { bytes, type };
}

// Looks the player up if needed and returns the saved row ({ status, ... }) or null.
export async function ensurePlayerPhoto(player) {
  const supabase = getSupabase();
  if (!supabase || !player || !ID.test(String(player.player_id))) return null;
  try {
    const { data: row, error } = await supabase.from('player_photos').select('*').eq('player_id', player.player_id).maybeSingle();
    if (error) return null; // database/019 not run yet
    const key = process.env.API_FOOTBALL_KEY;
    if (!needsLookup(row) || !key) return row ?? null;

    let pick = { status: 'none' };
    for (const term of searchTerms(player.name)) {
      pick = pickProfile(player, await apiSearch(term, key));
      if (pick.status !== 'none') break;
    }
    const save = async (fields) => {
      const next = { player_id: player.player_id, checked_at: new Date().toISOString(), api_player_id: null, api_name: null, photo_path: null, photo_hash: null, ...fields };
      await supabase.from('player_photos').upsert(next);
      return next;
    };
    if (pick.status !== 'found') return save({ status: pick.status });

    const image = await fetchImage(pick.profile.photo);
    if (!image) return save({ status: 'none', api_player_id: pick.profile.id, api_name: pick.profile.name });
    const hash = createHash('sha256').update(image.bytes).digest('hex');
    // API-Football uses one blank picture for players it has no photo of. If another player already has
    // exactly the same picture, it is that blank one: both are marked so neither shows it.
    const { data: twins } = await supabase.from('player_photos').select('player_id, photo_path').eq('photo_hash', hash).neq('player_id', player.player_id);
    if (twins?.length) {
      const paths = twins.map((t) => t.photo_path).filter(Boolean);
      if (paths.length) await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove(paths);
      await supabase.from('player_photos').update({ status: 'placeholder', photo_path: null }).eq('photo_hash', hash);
      return save({ status: 'placeholder', api_player_id: pick.profile.id, api_name: pick.profile.name, photo_hash: hash });
    }
    const path = `${player.player_id}.${image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1]}`;
    const { error: upErr } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).upload(path, image.bytes, { contentType: image.type, upsert: true });
    if (upErr) { console.error('player photo upload failed:', upErr); return row ?? null; }
    return save({ status: 'found', api_player_id: pick.profile.id, api_name: pick.profile.name, photo_path: path, photo_hash: hash });
  } catch (e) {
    console.error('player photo lookup failed:', e.message);
    return null;
  }
}

// The stored photo for a player, or null. Used by /player-photo/[id].
export async function readPlayerPhoto(playerId) {
  if (!ID.test(String(playerId))) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: row, error } = await supabase.from('player_photos').select('status, photo_path').eq('player_id', playerId).maybeSingle();
  if (error || row?.status !== 'found' || !row.photo_path) return null;
  const { data, error: dlErr } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).download(row.photo_path);
  if (dlErr || !data) return null;
  return { bytes: Buffer.from(await data.arrayBuffer()), type: data.type || 'image/png' };
}
