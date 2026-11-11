// Test only, second method: find each player by name instead of through their club.
// Shows nothing in the app, saves nothing and downloads no photos. It prints counts.
//
// Why: the club method lost most players because our Football Manager list has older clubs, loans
// and made-up club names ("Bergamo"). This method searches API-Football's player profiles by
// surname, then keeps a profile only when the name, nationality and age (within a year) all agree
// and exactly one profile fits. One request per player.
//
// Run in the Codespace:
//   node --env-file=.env.local scripts/photo-coverage-by-name.mjs        (the same 20 players as the club test)
//   node --env-file=.env.local scripts/photo-coverage-by-name.mjs --from=14   (carry on from player 14)
//   Press Ctrl+C only once it prints the totals: the photo check runs at the very end.

import { createClient } from '@supabase/supabase-js';

const API = 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY;
const want = Math.min(Number(process.argv.slice(2).find((x) => /^\d+$/.test(x))) || 20, 30);
const args = process.argv.slice(2);
const from = Math.max(Number((args.find((x) => x.startsWith('--from=')) ?? '').slice(7)) || 1, 1);
const nation = args.filter((x) => !x.startsWith('--') && Number.isNaN(Number(x)))[0] ?? '';
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
const todo = players.slice(from - 1);
console.log(`Checking ${players.length} players aged 18 to 21${nation ? ` from ${nation}` : ''}, picked at random from ${pool.length}.\n`);

let status;
try { status = await call('/status'); } catch (e) { console.error(`${e.message}\nCheck API_FOOTBALL_KEY in .env.local.`); process.exit(1); }
const acct = status?.response;
console.log(`Plan: ${acct?.subscription?.plan ?? 'unknown'}. Requests today before this test: ${acct?.requests?.current ?? '?'} of ${acct?.requests?.limit_day ?? '?'}.\n`);

// Nationality names differ a little ("Korea Republic" and "South Korea"), so one only has to contain the other's main word.
const sameNation = (a, b) => {
  const x = words(a).filter((w) => !['republic', 'of', 'the', 'south', 'north'].includes(w)), y = words(b);
  return x.length > 0 && x.some((w) => y.includes(w));
};
// Search terms: the surname first, then the first name (Korean names put the family name first, so
// "Kim Ji-soo" is found under "Kim"). API-Football needs at least 4 letters, so shorter words are skipped
// ("Juma Bah" is searched as "Juma"). Anything in brackets is ignored, and "O'Connor" is searched as "Connor".
// A later term only runs when the earlier ones find nobody who fits.
const cleanName = (name) => String(name ?? '').replace(/\(.*?\)/g, ' ').trim();
const searchTerms = (name) => {
  // Hyphenated parts are joined ("Ji-soo" becomes "jisoo"); after an apostrophe the longer piece is used.
  const parts = cleanName(name).split(/\s+/).map((w) => w.split(/['’]/).map((x) => words(x).join('')).sort((x, y) => y.length - x.length)[0] ?? '');
  return [...new Set([parts[parts.length - 1], parts[0], ...parts].filter((w) => w && w.length >= 4))].slice(0, 2);
};

const results = [];
let stop = false;
for (const [k, p] of todo.entries()) {
  const i = k + from - 1;
  let r;
  const terms = searchTerms(p.name);
  try {
    if (!terms.length) r = [p, 'name too short to search', null];
    for (const term of terms) {
      const found = (await call(`/players/profiles?search=${encodeURIComponent(term)}`)).response ?? [];
      const fits = found.map((x) => x.player).filter((m) => m
        && (sameName(cleanName(p.name), m.name) || sameName(cleanName(p.name), `${m.firstname ?? ''} ${m.lastname ?? ''}`))
        && (!p.nationality || !m.nationality || sameNation(p.nationality, m.nationality))
        && (m.age == null || p.age_snapshot == null || Math.abs(m.age - p.age_snapshot) <= 1));
      if (fits.length === 1) { r = [p, fits[0].photo ? 'matched' : 'matched, no photo link', fits[0]]; break; }
      if (fits.length > 1) { r = [p, `unsure (${fits.length} possible)`, null]; break; }
      r = [p, `no profile fits (searched ${terms.slice(0, terms.indexOf(term) + 1).map((t) => `"${t}"`).join(' and ')})`, null];
    }
  } catch (e) {
    r = [p, e.message, null];
    // Stop only for account problems (key, plan or limits). A problem with one search just skips that player.
    stop = /API-Football said/.test(e.message) && /limit|token|key|plan|subscri|request/i.test(e.message);
  }
  results.push(r);
  console.log(`${String(i + 1).padStart(2)}/${players.length} ${p.name} (${p.age_snapshot}, ${p.nationality}): ${r[1]}${r[2] ? ` as "${r[2].name}", ${r[2].nationality}` : ''}`);
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

console.log('');
console.log(`Players matched by name, nationality and age: ${matched} of ${results.length}.`);
console.log(`Would show a photo: ${photos} of ${results.length}.`);
if (count > 2) console.log(`(${count} matched players share one image size, so it is treated as the blank placeholder and not counted.)`);
console.log(`API requests used by this test: ${used}.`);
