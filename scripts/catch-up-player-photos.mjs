// One-off catch-up: looks up photos for every player past scout runs picked, so Past scouts can
// show them without anyone opening each player page. New scout runs do this by themselves.
// Uses the same rules as the app (lib/player-photo-lookup.mjs). Safe to run again: players
// already looked up are skipped and cost nothing.
//
// Run in the Codespace (reads SUPABASE_URL, SUPABASE_SECRET_KEY and API_FOOTBALL_KEY from .env.local):
//   node --env-file=.env.local scripts/catch-up-player-photos.mjs
//   node --env-file=.env.local scripts/catch-up-player-photos.mjs --max=50     (look up at most 50 players)
//   node --env-file=.env.local scripts/catch-up-player-photos.mjs --recheck    (try players with no certain match again now)
import { createClient } from '@supabase/supabase-js';
import { AccountProblem, lookupPlayerPhoto } from '../lib/player-photo-lookup.mjs';
import { needsLookup } from '../lib/player-photo-match.mjs';

const API = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY;
const recheck = process.argv.includes('--recheck');
const max = Number((process.argv.find((a) => a.startsWith('--max=')) ?? '').slice(6)) || 200;
if (!KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing API_FOOTBALL_KEY, SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How many requests are left today. Each player costs 1 or 2.
const status = await fetch(`${API}/status`, { headers: { 'x-apisports-key': KEY } }).then((r) => r.json()).catch(() => ({}));
const acct = status?.response ?? {};
const left = (acct.requests?.limit_day ?? 0) - (acct.requests?.current ?? 0);
console.log(`Plan: ${acct.subscription?.plan ?? 'unknown'}. Requests left today: ${Number.isFinite(left) ? left : '?'}.`);

const { data: runs, error } = await supabase.from('scout_runs').select('picks').eq('status', 'completed');
if (error) { console.error('Could not read scout runs:', error.message); process.exit(1); }
const ids = [...new Set(runs.flatMap((r) => (r.picks ?? []).map((p) => String(p.player_id))))];
const { data: done, error: e2 } = await supabase.from('player_photos').select('player_id, status, checked_at').in('player_id', ids);
if (e2) { console.error('Could not read player_photos. Has database/019_player_photos.sql been run?', e2.message); process.exit(1); }
const saved = new Map(done.map((r) => [r.player_id, r]));
const todo = ids.filter((id) => needsLookup(saved.get(id), Date.now(), recheck)).slice(0, max);
console.log(`${ids.length} players picked by past scouts. ${ids.length - todo.length} already looked up. Looking up ${todo.length} now.\n`);
if (Number.isFinite(left) && left < todo.length * 2) console.log(`Note: that may need up to ${todo.length * 2} requests. If it stops at the limit, run it again tomorrow.\n`);

const { data: players } = await supabase.from('players').select('player_id, name, nationality, age_snapshot').in('player_id', todo);
const counts = { found: 0, none: 0, unsure: 0, placeholder: 0, skipped: 0 };
for (const [i, p] of (players ?? []).entries()) {
  let row;
  try {
    row = await lookupPlayerPhoto(p, { supabase, key: KEY, apiBase: API, mediaBase: process.env.API_FOOTBALL_MEDIA_BASE_URL, throwAccountProblems: true, recheck });
  } catch (e) {
    if (e instanceof AccountProblem) { console.error(`\nStopped: ${e.message}. Run it again later; finished players are kept.`); break; }
    throw e;
  }
  const s = row?.status ?? 'skipped';
  counts[s] = (counts[s] ?? 0) + 1;
  const label = { found: 'photo found', none: 'no certain match', unsure: 'several possible profiles, none shown', placeholder: 'only a blank picture', skipped: 'skipped (try again later)' }[s];
  console.log(`${String(i + 1).padStart(3)}/${players.length} ${p.name}: ${label}`);
  await sleep(700);
}
// Counted again from the database at the end: a photo can turn out to be the blank picture once a later player has it too.
const { data: after } = await supabase.from('player_photos').select('status').in('player_id', (players ?? []).map((p) => p.player_id));
const final = (after ?? []).reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
console.log(`\nPhotos found: ${final.found ?? 0}. No certain match: ${(final.none ?? 0) + (final.unsure ?? 0)}. Blank picture: ${final.placeholder ?? 0}. Skipped: ${counts.skipped}.`);
