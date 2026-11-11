// Check mode for player photos: for each player with no certain match, shows the closest profiles
// API-Football returned and which rule each one failed (name, nationality or age). Changes nothing:
// it only reads and prints, so we can see whether a rule is too strict before touching it.
//
// Run in the Codespace:
//   node --env-file=.env.local scripts/diagnose-photo-misses.mjs
//   node --env-file=.env.local scripts/diagnose-photo-misses.mjs "Rio Ngumoha"     (one player)
import { createClient } from '@supabase/supabase-js';
import { sameName, sameNation, searchTerms, words, cleanName } from '../lib/player-photo-match.mjs';

const API = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY;
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('Missing API_FOOTBALL_KEY, SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(term) {
  const res = await fetch(`${API}/players/profiles?search=${encodeURIComponent(term)}`, { headers: { 'x-apisports-key': KEY } });
  const body = await res.json().catch(() => ({}));
  const errs = body?.errors && (Array.isArray(body.errors) ? body.errors : Object.values(body.errors));
  if (errs?.length) throw new Error(`API-Football said: ${errs.join('; ')}`);
  await sleep(700);
  return (body.response ?? []).map((x) => x.player).filter(Boolean);
}

let players;
if (only) {
  const { data } = await supabase.from('players').select('player_id, name, nationality, age_snapshot, club_snapshot').ilike('name', `%${only}%`).limit(3);
  players = data ?? [];
} else {
  const { data: rows, error } = await supabase.from('player_photos').select('player_id, status').in('status', ['none', 'unsure']);
  if (error) { console.error('Could not read player_photos:', error.message); process.exit(1); }
  const { data } = await supabase.from('players').select('player_id, name, nationality, age_snapshot, club_snapshot').in('player_id', rows.map((r) => r.player_id));
  players = data ?? [];
}
console.log(`Checking ${players.length} player${players.length === 1 ? '' : 's'}.\n`);

const tick = (ok) => (ok ? 'yes' : 'NO ');
for (const p of players) {
  console.log(`${p.name} · ours: age ${p.age_snapshot}, ${p.nationality}, ${p.club_snapshot}`);
  const terms = searchTerms(p.name);
  if (!terms.length) { console.log('  No search possible: every part of the name is under 4 letters.\n'); continue; }
  const seen = new Map();
  for (const t of terms) for (const m of await search(t)) seen.set(m.id, m);
  const ours = words(cleanName(p.name));
  // Closest first: profiles sharing more words with our name.
  const close = [...seen.values()]
    .map((m) => ({ m, overlap: new Set([...words(m.name), ...words(m.firstname), ...words(m.lastname)].filter((w) => ours.includes(w) || ours.some((o) => o[0] === w && w.length === 1))).size }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5);
  console.log(`  Searched ${terms.map((t) => `"${t}"`).join(' and ')}: ${seen.size} profiles, ${close.length} close.`);
  if (!close.length) console.log('  None share a word with our name. API-Football probably lists him differently, or not at all.');
  for (const { m } of close) {
    const nameOk = sameName(p.name, m.name) || sameName(p.name, `${m.firstname ?? ''} ${m.lastname ?? ''}`);
    const nationOk = !p.nationality || !m.nationality || sameNation(p.nationality, m.nationality);
    const gap = m.age == null || p.age_snapshot == null ? null : Math.abs(m.age - p.age_snapshot);
    const full = `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim();
    console.log(`  - "${m.name}"${full ? ` (${full})` : ''}, age ${m.age ?? '?'}, born ${m.birth?.date ?? '?'}, ${m.nationality ?? '?'}`);
    console.log(`      name ${tick(nameOk)}  nationality ${tick(nationOk)}  age ${tick(gap == null || gap <= 1)}${gap != null && gap > 1 ? ` (${gap} years apart)` : ''}`);
  }
  console.log('');
}
