import 'server-only';
import { getSupabase } from './supabase-server';
import { lookupPlayerPhoto } from './player-photo-lookup.mjs';
import { PLAYER_PHOTO_BUCKET } from './player-photo-match.mjs';

// Player photos from API-Football (12 Nov 2026). The team checked API-Football's terms first.
// One lookup per player, saved in player_photos, so a player is never looked up twice.
// Nothing here ever throws: a page always loads, with or without photos.

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const options = () => ({
  supabase: getSupabase(),
  key: process.env.API_FOOTBALL_KEY,
  apiBase: process.env.API_FOOTBALL_BASE_URL,
  mediaBase: process.env.API_FOOTBALL_MEDIA_BASE_URL,
});

// Looks the player up if needed and returns the saved row ({ status, ... }) or null.
export async function ensurePlayerPhoto(player) {
  return lookupPlayerPhoto(player, options());
}

// Looks up several players by id, one after another (used when a scout run finishes).
export async function ensurePlayerPhotos(playerIds) {
  const ids = [...new Set((playerIds ?? []).map(String).filter((id) => ID.test(id)))].slice(0, 10);
  const opts = options();
  if (!ids.length || !opts.supabase || !opts.key) return;
  try {
    const { data: players } = await opts.supabase.from('players').select('player_id, name, nationality, age_snapshot, club_snapshot').in('player_id', ids);
    for (const p of players ?? []) await lookupPlayerPhoto(p, opts);
  } catch (e) {
    console.error('player photos for scout picks failed:', e.message);
  }
}

// Which of these players have a photo to show. No lookups: only what is already saved.
export async function playersWithPhotos(playerIds) {
  const ids = [...new Set((playerIds ?? []).map(String).filter((id) => ID.test(id)))];
  const supabase = getSupabase();
  if (!ids.length || !supabase) return new Set();
  const { data, error } = await supabase.from('player_photos').select('player_id').eq('status', 'found').in('player_id', ids);
  return new Set(error ? [] : (data ?? []).map((r) => r.player_id));
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
