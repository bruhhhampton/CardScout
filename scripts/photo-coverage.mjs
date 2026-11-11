// Test only: how many of our young players could get a photo from API-Football?
// Shows nothing in the app, saves nothing and downloads no photos. It prints counts.
//
// Run in the Codespace (reads SUPABASE_URL, SUPABASE_SECRET_KEY and API_FOOTBALL_KEY from .env.local):
//   node --env-file=.env.local scripts/photo-coverage.mjs                 (20 players aged 18 to 21)
//   Press Ctrl+C only once it prints the totals: the photo check runs at the very end.
//   node --env-file=.env.local scripts/photo-coverage.mjs 20 korea        (optional nationality)
//
// How it works, using few requests: for each club it finds the club (1 or 2 requests), then its
// current squad (1 request). A club only counts when its name matches ours exactly once we ignore
// words like FC, Club and Boldklub. A player only counts as matched when exactly one squad member
// has the same name (allowing for word order, hyphens and initials) and an age within one year.
// Squads are the current season, so the season limit on free plans does not apply here.

import { createClient } from '@supabase/supabase-js';

const API = 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY;
const want = Math.min(Number(process.argv[2]) || 20, 30);
const nation = process.argv[3] ?? '';
if (!KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing API_FOOTBALL_KEY, SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let used = 0;

// One API call. Waits if the per-minute limit is nearly used. Never prints the key.
async function call(path) {
  const res = await fetch(API + path, { headers: { 'x-apisports-key': KEY } });
  used += 1;
  const body = await res.json().catch(() => ({}));
  const errs = body?.errors && (Array.isArray(body.errors) ? body.errors : Object.values(body.errors));
  if (errs?.length) throw new Error(`API-Football said: ${errs.join('; ')}`);
  const perMinute = Number(res.headers.get('x-ratelimit-remaining'));
  if (Number.isFinite(perMinute) && perMinute <= 1) console.log('  (waiting a minute for the per-minute limit)');
  await sleep(Number.isFinite(perMinute) && perMinute <= 1 ? 61000 : 1500);
  return body;
}

// Letters that accent-stripping alone does not handle (Strømsgodset, Dæhlin).
const LETTERS = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ł: 'l', ı: 'i', þ: 'th', ð: 'd' };
const words = (s) => String(s ?? '').toLowerCase().replace(/[øæœßđłıþð]/g, (c) => LETTERS[c])
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

// Names compared without accents, case, hyphens or word order. "J. Kim" can match "Kim Ji-soo".
function sameName(ours, theirs) {
  const a = words(ours), b = words(theirs);
  if ([...a].sort().join(' ') === [...b].sort().join(' ') || a.join('') === b.join('')) return true;
  const full = b.filter((w) => w.length > 1), initials = b.filter((w) => w.length === 1);
  if (full.length === 0 || !full.every((w) => a.includes(w))) return false;
  // A shorter version of our name, such as "Kevin Dæhlin" for "Kevin André Dæhlin" (two full words or more).
  if (initials.length === 0) return full.length >= 2;
  // Initials plus surname, such as "J. Kim" or "K. A. Dæhlin": each initial starts one of our other words, in order.
  const rest = a.filter((w) => !full.includes(w));
  let k = 0;
  for (const w of rest) if (k < initials.length && w[0] === initials[k]) k += 1;
  return k === initials.length;
}

// Club names without the generic words, so "AFC Ajax" and "Ajax", or "Vejle Boldklub" and "Vejle", are equal.
const GENERIC = new Set(['fc', 'cf', 'sc', 'afc', 'bsc', 'rsc', 'losc', 'ssc', 'ac', 'as', 'cd', 'ud', 'sd', 'ca', 'rc', 'sv', 'vfb', 'vfl', 'tsg', 'fk', 'sk', 'if', 'bk', 'ik', 'aik',
  'club', 'stade', 'de', 'del', 'la', 'the', 'football', 'futbol', 'futebol', 'calcio', 'boldklub', 'toppfotball', 'fotball', 'sociedad', 'deportiva', 'deportivo', 'clube', 'esporte', 'sport', 'sporting', 'hyundai', 'motors']);
// Numbers are dropped too, so "Como 1907" and "Como" are equal.
const clubWords = (s) => words(s).filter((w) => !GENERIC.has(w) && !/^\d+$/.test(w));
const sameWords = (a, b) => words(a).filter((w) => !/^\d+$/.test(w)).sort().join(' ') === words(b).filter((w) => !/^\d+$/.test(w)).sort().join(' ');
const sameClub = (a, b) => { const x = clubWords(a), y = clubWords(b); return x.length > 0 && [...x].sort().join(' ') === [...y].sort().join(' '); };
const youth = (name) => /\b(ii|b|u\d\d|w|women|reserves|youth|jong)\b/i.test(name ?? '');

// Returns the clubs that could be ours. When the name alone leaves more than one (Juventus in Italy,
// Brazil and Haiti), the squads decide: a player only counts if exactly one of those squads has them.
async function findClub(club) {
  const terms = clubWords(club).filter((w) => w.length >= 3).sort((x, y) => y.length - x.length).slice(0, 2);
  if (!terms.length) return { note: 'club name too short to search' };
  for (const term of terms) {
    const teams = ((await call(`/teams?search=${encodeURIComponent(term)}`)).response ?? []).filter((t) => !t.team?.national && !youth(t.team?.name));
    let fits = teams.filter((t) => sameClub(club, t.team?.name));
    // "Barcelona" beats "Barcelona SC" and "Liverpool" beats "AFC Liverpool" when the full name is identical.
    const identical = fits.filter((t) => sameWords(club, t.team?.name));
    if (identical.length) fits = identical;
    if (fits.length > 3) return { note: `club unclear (${fits.length} clubs share the name)` };
    if (fits.length) return { candidates: fits.map((t) => ({ id: t.team.id, name: t.team.name, country: t.team.country })) };
  }
  return { note: 'club not found' };
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
// Aged 18 to 21: old enough to be in a first-team squad. A fixed random sample, so every run checks the same
// players and famous names do not crowd out the rest.
let q = supabase.from('players').select('player_id, name, nationality, club_snapshot, age_snapshot').gte('age_snapshot', 18).lte('age_snapshot', 21).not('club_snapshot', 'is', null);
if (nation) q = q.ilike('nationality', `%${nation}%`);
const { data: pool, error } = await q.order('player_id').limit(1000);
if (error) { console.error('Could not read players:', error.message); process.exit(1); }
let seed = 3605;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
const players = pool.slice(0, want);
console.log(`Checking ${players.length} players aged 18 to 21${nation ? ` from ${nation}` : ''}, picked at random from ${pool.length}.\n`);

let status;
try { status = await call('/status'); } catch (e) { console.error(`${e.message}\nCheck API_FOOTBALL_KEY in .env.local.`); process.exit(1); }
const acct = status?.response;
console.log(`Plan: ${acct?.subscription?.plan ?? 'unknown'}. Requests today before this test: ${acct?.requests?.current ?? '?'} of ${acct?.requests?.limit_day ?? '?'}.\n`);

const clubs = new Map(); // our club name -> { note } or { candidates }
const squadOf = new Map(); // API team id -> squad members
const results = [];
let stop = false;
for (const [i, p] of players.entries()) {
  const club = p.club_snapshot;
  let r;
  try {
    if (!clubs.has(club)) clubs.set(club, await findClub(club));
    const found = clubs.get(club);
    if (found.note) r = [p, found.note, null];
    else {
      const homes = [];
      for (const c of found.candidates) {
        if (!squadOf.has(c.id)) squadOf.set(c.id, (await call(`/players/squads?team=${c.id}`)).response?.[0]?.players ?? []);
        const hits = squadOf.get(c.id).filter((m) => sameName(p.name, m.name) && (m.age == null || p.age_snapshot == null || Math.abs(m.age - p.age_snapshot) <= 1));
        if (hits.length) homes.push({ c, hits });
      }
      if (homes.length === 1 && homes[0].hits.length === 1) {
        const m = homes[0].hits[0];
        found.used = homes[0].c;
        r = [p, m.photo ? 'matched' : 'matched, no photo link', m];
      } else if (homes.length) r = [p, `unsure (${homes.reduce((n, h) => n + h.hits.length, 0)} possible)`, null];
      else r = [p, `not in ${found.candidates.length > 1 ? `the squads of ${found.candidates.length} clubs called ${found.candidates[0].name}` : `${found.candidates[0].name}'s current squad`}`, null];
    }
  } catch (e) {
    r = [p, e.message, null];
    stop = /API-Football said/.test(e.message);
  }
  results.push(r);
  console.log(`${String(i + 1).padStart(2)}/${players.length} ${p.name} (${p.age_snapshot}, ${club}): ${r[1]}${r[2] ? ` as "${r[2].name}"` : ''}`);
  if (stop) { console.error('Stopped early.'); break; }
}

// Players without a real photo share one placeholder image. Spot it by its size (header only, no download).
const sizes = new Map();
for (const r of results.filter((r) => r[1] === 'matched')) {
  const head = await fetch(r[2].photo, { method: 'HEAD' }).catch(() => null);
  r[3] = head?.ok ? head.headers.get('content-length') : null;
  if (r[3]) sizes.set(r[3], (sizes.get(r[3]) ?? 0) + 1);
  await sleep(300);
}
const [placeholder, count] = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
const looksPlaceholder = (r) => count > 2 && r[3] === placeholder;
const photos = results.filter((r) => r[1] === 'matched' && !looksPlaceholder(r)).length;
const matched = results.filter((r) => r[1].startsWith('matched')).length;
const clubsFound = [...clubs.values()].filter((c) => c.candidates).length;

console.log(`\nClubs found: ${clubsFound} of ${clubs.size}.`);
console.log(`Players matched in their club's squad: ${matched} of ${results.length}.`);
console.log(`Would show a photo: ${photos} of ${results.length}.`);
if (count > 2) console.log(`(${count} matched players share one image size, so it is treated as the blank placeholder and not counted.)`);
console.log(`API requests used by this test: ${used}.`);
