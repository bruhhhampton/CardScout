// The player photo lookup itself, shared by the app (lib/player-photos.js) and the one-off
// catch-up script (scripts/catch-up-player-photos.mjs). It takes the database client and the
// API-Football key as arguments, so it never reads secrets itself and runs outside Next.js too.
// Nothing here throws for a single player: problems return null and nothing is saved, so the
// player is simply tried again later.
import { createHash } from 'node:crypto';
import { clubTerms, isApiPhotoUrl, MAX_PLAYER_PHOTO, needsLookup, pickClubs, pickFromSquads, pickProfile, PLAYER_PHOTO_BUCKET, searchTerms } from './player-photo-match.mjs';

const ID = /^[A-Za-z0-9_-]{1,40}$/;

// A key, plan or limit problem. The caller should stop, not carry on to the next player.
export class AccountProblem extends Error {}

async function apiGet(path, { key, apiBase }) {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { 'x-apisports-key': key }, signal: AbortSignal.timeout(6000), cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  const errs = body?.errors && (Array.isArray(body.errors) ? body.errors : Object.values(body.errors));
  if (!res.ok || errs?.length) {
    const msg = `API-Football: ${errs?.join('; ') || res.status}`;
    throw /limit|token|key|plan|subscri|request/i.test(msg) ? new AccountProblem(msg) : new Error(msg);
  }
  return body.response ?? [];
}
const apiSearch = async (term, o) => (await apiGet(`/players/profiles?search=${encodeURIComponent(term)}`, o)).map((x) => x.player).filter(Boolean);

// Backup: the player's club's current squad (for players the name search cannot reach, such as
// a surname shared by hundreds of profiles). Costs 1 or 2 requests to find the club, then 1 per squad.
async function squadSearch(player, o) {
  if (!player.club_snapshot) return { status: 'none' };
  for (const term of clubTerms(player.club_snapshot)) {
    const ids = pickClubs(player.club_snapshot, await apiGet(`/teams?search=${encodeURIComponent(term)}`, o));
    if (!ids.length) continue;
    const squads = [];
    for (const id of ids) squads.push(((await apiGet(`/players/squads?team=${id}`, o))[0]?.players) ?? []);
    return pickFromSquads(player, squads);
  }
  return { status: 'none' };
}

async function fetchImage(url, mediaBase) {
  if (!isApiPhotoUrl(url)) return null;
  // Tests point mediaBase at a stand-in server; in real use it is empty and the address is used as given.
  const from = mediaBase ? url.replace('https://media.api-sports.io', mediaBase) : url;
  const res = await fetch(from, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!res.ok || !/^image\/(png|jpeg|webp)$/.test(type)) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PLAYER_PHOTO) return null;
  return { bytes, type };
}

// Looks one player up if needed. player: { player_id, name, nationality, age_snapshot, club_snapshot }.
// opts: { supabase, key, apiBase, mediaBase, throwAccountProblems, recheck }. recheck looks up
// players with no certain match again now, instead of waiting 30 days. Returns the saved row or null.
export async function lookupPlayerPhoto(player, opts) {
  const { supabase, key } = opts;
  const apiBase = opts.apiBase || 'https://v3.football.api-sports.io';
  if (!supabase || !player || !ID.test(String(player.player_id))) return null;
  try {
    const { data: row, error } = await supabase.from('player_photos').select('*').eq('player_id', player.player_id).maybeSingle();
    if (error) return null; // database/019 not run yet
    if (!needsLookup(row, Date.now(), opts.recheck) || !key) return row ?? null;

    let pick = { status: 'none' };
    for (const term of searchTerms(player.name)) {
      pick = pickProfile(player, await apiSearch(term, { key, apiBase }));
      if (pick.status !== 'none') break;
    }
    if (pick.status === 'none') pick = await squadSearch(player, { key, apiBase });
    const save = async (fields) => {
      const next = { player_id: player.player_id, checked_at: new Date().toISOString(), api_player_id: null, api_name: null, photo_path: null, photo_hash: null, ...fields };
      await supabase.from('player_photos').upsert(next);
      return next;
    };
    if (pick.status !== 'found') return save({ status: pick.status });

    const image = await fetchImage(pick.profile.photo, opts.mediaBase);
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
    if (upErr) { console.error('player photo upload failed:', upErr.message ?? upErr); return row ?? null; }
    return save({ status: 'found', api_player_id: pick.profile.id, api_name: pick.profile.name, photo_path: path, photo_hash: hash });
  } catch (e) {
    if (e instanceof AccountProblem && opts.throwAccountProblems) throw e;
    console.error('player photo lookup failed:', e.message);
    return null;
  }
}
