// Plain rules for matching one of our players to an API-Football profile. No network or database here,
// so they can be tested on their own (evaluation/player_photo_tests.mjs).
// The rule: keep a profile only when the name, nationality and age (within a year) all agree and
// exactly one profile fits. Anything less certain shows no photo.

// Letters that accent-stripping alone does not handle (Strømsgodset, Dæhlin).
const LETTERS = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ł: 'l', ı: 'i', þ: 'th', ð: 'd' };
export const words = (s) => String(s ?? '').toLowerCase().replace(/[øæœßđłıþð]/g, (c) => LETTERS[c])
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

// Anything in brackets is dropped: some imported names carry their club, as in "Nicolás Rodríguez(Orlando City SC,Colombia)".
export const cleanName = (name) => String(name ?? '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();

// How well a profile's name fits ours: 'full' (every word, in any order, or two full words of it),
// 'initials' ("J. Kim" for "Kim Ji-soo") or null. Accents, case and hyphens are ignored.
export function nameFit(ours, theirs) {
  const a = words(cleanName(ours)), b = words(theirs);
  if (!a.length || !b.length) return null;
  if ([...a].sort().join(' ') === [...b].sort().join(' ') || a.join('') === b.join('')) return 'full';
  const full = b.filter((w) => w.length > 1), initials = b.filter((w) => w.length === 1);
  if (full.length === 0 || !full.every((w) => a.includes(w))) return null;
  // A shorter version of our name, such as "Kevin Dæhlin" for "Kevin André Dæhlin" (two full words or more).
  if (initials.length === 0) return full.length >= 2 ? 'full' : null;
  // Initials plus surname: each initial starts one of our other words, in order.
  const rest = a.filter((w) => !full.includes(w));
  let k = 0;
  for (const w of rest) if (k < initials.length && w[0] === initials[k]) k += 1;
  return k === initials.length ? 'initials' : null;
}
export const sameName = (ours, theirs) => nameFit(ours, theirs) !== null;

// Nationalities are compared whole, after mapping the different spellings the two sources use
// ("Ivory Coast" and "Côte d'Ivoire"). Ours can list several ("England,Nigeria"): any one may match.
const NATION_ALIAS = {
  cotedivoire: 'ivorycoast', korearepublic: 'southkorea', republicofkorea: 'southkorea', koreasouth: 'southkorea',
  korea: 'southkorea', koreadpr: 'northkorea', turkey: 'turkiye', czechia: 'czechrepublic', caboverde: 'capeverde',
  congodr: 'drcongo', democraticrepublicofthecongo: 'drcongo', drc: 'drcongo', usa: 'unitedstates',
  unitedstatesofamerica: 'unitedstates', republicofireland: 'ireland', irelandrepublic: 'ireland',
  bosniaandherzegovina: 'bosnia', northmacedonia: 'macedonia', fyrmacedonia: 'macedonia', chinapr: 'china',
  iriran: 'iran', curacao: 'curacao', guineabissau: 'guineabissau', eswatini: 'swaziland', unitedarabemirates: 'uae',
};
const nation = (s) => { const k = words(s).join(''); return NATION_ALIAS[k] ?? k; };
export function sameNation(ours, theirs) {
  const t = nation(theirs);
  return Boolean(t) && String(ours ?? '').split(',').some((one) => nation(one) === t);
}

// Search terms, tried in order until one finds a fit: the surname joined ("Lewis-Skelly" as "lewisskelly"),
// then each part of a hyphenated surname ("lewis", "skelly"; "Young-Jun" gives "young"), then the first name.
// API-Football needs at least 4 letters, and after an apostrophe the longer piece is used ("connor").
export function searchTerms(name) {
  const raw = cleanName(name).split(/\s+/).filter(Boolean);
  const joined = (w) => w.split(/['’]/).map((x) => words(x).join('')).sort((x, y) => y.length - x.length)[0] ?? '';
  const last = raw[raw.length - 1] ?? '';
  const pieces = last.includes('-') ? last.split('-').map(joined) : [];
  const terms = [joined(last), ...pieces, joined(raw[0] ?? ''), ...raw.slice(1, -1).map(joined)];
  return [...new Set(terms.filter((w) => w && w.length >= 4))].slice(0, 4);
}

// Picks the one profile that fits, from a list of API-Football profiles
// ({ id, name, firstname, lastname, age, nationality, photo }).
// The rules, strictest where the evidence is weakest:
//   - A full-name match may differ in age by up to 2 years (our Football Manager ages are often a year or
//     two behind). If the profile has no nationality, the age must be within 1 year.
//   - An initials-only match ("L. Myles") needs a known nationality that matches and an age within 1 year.
//   - If more than one profile passes, the one full-name match with a known nationality wins; otherwise unsure.
// Returns { status: 'found', profile } or { status: 'unsure' } or { status: 'none' }.
export function pickProfile(player, profiles) {
  const scored = (profiles ?? []).filter(Boolean).map((m) => {
    const fits = [nameFit(player.name, m.name), nameFit(player.name, `${m.firstname ?? ''} ${m.lastname ?? ''}`)];
    const fit = fits.includes('full') ? 'full' : fits.includes('initials') ? 'initials' : null;
    const known = Boolean(m.nationality) && Boolean(player.nationality);
    const nationOk = known ? sameNation(player.nationality, m.nationality) : !player.nationality || !m.nationality;
    const gap = m.age == null || player.age_snapshot == null ? null : Math.abs(Number(m.age) - Number(player.age_snapshot));
    let ok = false;
    if (fit === 'full') ok = nationOk && (known ? gap == null || gap <= 2 : gap == null || gap <= 1);
    if (fit === 'initials') ok = known && nationOk && gap != null && gap <= 1;
    return { m, ok, strong: ok && fit === 'full' && known };
  });
  const fits = scored.filter((x) => x.ok);
  const strong = fits.filter((x) => x.strong);
  const one = fits.length === 1 ? fits[0] : strong.length === 1 ? strong[0] : null;
  if (one) return isApiPhotoUrl(one.m.photo) ? { status: 'found', profile: one.m } : { status: 'none' };
  return { status: fits.length ? 'unsure' : 'none' };
}

// Backup when the name search finds nobody: look in the player's club's current squad.
// Club names without generic words or years, so "AFC Ajax" is "Ajax" and "Como 1907" is "Como".
const CLUB_FILLER = new Set(['fc', 'cf', 'sc', 'afc', 'bsc', 'rsc', 'losc', 'ssc', 'ac', 'as', 'cd', 'ud', 'sd', 'ca', 'rc', 'sv', 'vfb', 'vfl', 'tsg', 'fk', 'sk', 'if', 'bk', 'ik', 'aik',
  'club', 'stade', 'de', 'del', 'la', 'the', 'football', 'fussballclub', 'futbol', 'futebol', 'calcio', 'boldklub', 'toppfotball', 'fotball', 'sociedad', 'deportiva', 'deportivo', 'clube', 'esporte', 'sport', 'sporting', 'hyundai', 'motors']);
// "RB" is written out, so "RB Salzburg" and "Red Bull Salzburg" match.
export const clubWords = (s) => words(s).flatMap((w) => (w === 'rb' ? ['red', 'bull'] : [w])).filter((w) => !CLUB_FILLER.has(w) && !/^\d+$/.test(w));
const sorted = (list) => [...list].sort().join(' ');
const youthTeam = (name) => /\b(ii|b|u\d\d|w|women|reserves|youth|jong)\b/i.test(name ?? '');
// The words to search a club by: its longest distinctive words (API-Football needs 3 letters or more).
export const clubTerms = (club) => clubWords(club).filter((w) => w.length >= 3).sort((x, y) => y.length - x.length).slice(0, 2);
// Teams whose name is ours, from a /teams search. "Barcelona" beats "Barcelona SC" when the name is identical.
// More than 3 left is too unclear, so none are returned.
export function pickClubs(club, teams) {
  const ours = clubWords(club);
  if (!ours.length) return [];
  let fits = (teams ?? []).filter((t) => t?.team && !t.team.national && !youthTeam(t.team.name) && sorted(clubWords(t.team.name)) === sorted(ours));
  const plain = (s) => sorted(words(s).filter((w) => !/^\d+$/.test(w)));
  const identical = fits.filter((t) => plain(t.team.name) === plain(club));
  if (identical.length) fits = identical;
  return fits.length <= 3 ? fits.map((t) => t.team.id) : [];
}
// The one squad member who is our player. Squads carry no nationality, but being in the right club
// is strong evidence, so the name must fit and the age be within 2 years. Exactly one must fit.
export function pickFromSquads(player, squads) {
  const fits = (squads ?? []).flat().filter((m) => m && nameFit(player.name, m.name)
    && (m.age == null || player.age_snapshot == null || Math.abs(Number(m.age) - Number(player.age_snapshot)) <= 2));
  if (fits.length === 1) return isApiPhotoUrl(fits[0].photo) ? { status: 'found', profile: fits[0] } : { status: 'none' };
  return { status: fits.length ? 'unsure' : 'none' };
}

// Photos are only ever fetched from API-Football's own image server.
export function isApiPhotoUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && u.hostname === 'media.api-sports.io' && /^\/football\/players\/\d+\.(png|jpe?g|webp)$/i.test(u.pathname);
  } catch { return false; }
}

// Players with no certain match are looked up again after this many days, in case API-Football adds them.
export const RECHECK_DAYS = 30;
export function needsLookup(row, now = Date.now(), recheck = false) {
  if (!row) return true;
  if (recheck) return row.status === 'none' || row.status === 'unsure';
  if (row.status === 'found' || row.status === 'placeholder') return false;
  return now - new Date(row.checked_at).getTime() > RECHECK_DAYS * 86400000;
}
export const PLAYER_PHOTO_BUCKET = 'player-photos';
export const MAX_PLAYER_PHOTO = 512 * 1024;
