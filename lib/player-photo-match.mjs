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

// Same person's name, allowing for accents, case, hyphens, word order and initials ("J. Kim" for "Kim Ji-soo").
export function sameName(ours, theirs) {
  const a = words(cleanName(ours)), b = words(theirs);
  if (!a.length || !b.length) return false;
  if ([...a].sort().join(' ') === [...b].sort().join(' ') || a.join('') === b.join('')) return true;
  const full = b.filter((w) => w.length > 1), initials = b.filter((w) => w.length === 1);
  if (full.length === 0 || !full.every((w) => a.includes(w))) return false;
  // A shorter version of our name, such as "Kevin Dæhlin" for "Kevin André Dæhlin" (two full words or more).
  if (initials.length === 0) return full.length >= 2;
  // Initials plus surname: each initial starts one of our other words, in order.
  const rest = a.filter((w) => !full.includes(w));
  let k = 0;
  for (const w of rest) if (k < initials.length && w[0] === initials[k]) k += 1;
  return k === initials.length;
}

// Nationality names differ a little ("Korea Republic" and "South Korea"), and ours can list several ("England,Nigeria").
const NATION_FILLER = new Set(['republic', 'of', 'the', 'south', 'north', 'and']);
export function sameNation(ours, theirs) {
  const y = words(theirs);
  return String(ours ?? '').split(',').some((one) => {
    const x = words(one).filter((w) => !NATION_FILLER.has(w));
    return x.length > 0 && x.some((w) => y.includes(w));
  });
}

// Search terms: the surname first, then the first name (Korean names put the family name first).
// API-Football needs at least 4 letters, hyphenated parts are joined ("Ji-soo" becomes "jisoo")
// and after an apostrophe the longer piece is used ("O'Connor" becomes "connor"). At most two terms.
export function searchTerms(name) {
  const parts = cleanName(name).split(/\s+/)
    .map((w) => w.split(/['’]/).map((x) => words(x).join('')).sort((x, y) => y.length - x.length)[0] ?? '');
  return [...new Set([parts[parts.length - 1], parts[0], ...parts].filter((w) => w && w.length >= 4))].slice(0, 2);
}

// Picks the one profile that fits, from a list of API-Football profiles ({ id, name, firstname, lastname, age, nationality, photo }).
// Returns { status: 'found', profile } or { status: 'unsure' } or { status: 'none' }.
export function pickProfile(player, profiles) {
  const fits = (profiles ?? []).filter((m) => m
    && (sameName(player.name, m.name) || sameName(player.name, `${m.firstname ?? ''} ${m.lastname ?? ''}`))
    && (!player.nationality || !m.nationality || sameNation(player.nationality, m.nationality))
    && (m.age == null || player.age_snapshot == null || Math.abs(Number(m.age) - Number(player.age_snapshot)) <= 1));
  if (fits.length === 1) return isApiPhotoUrl(fits[0].photo) ? { status: 'found', profile: fits[0] } : { status: 'none' };
  return { status: fits.length > 1 ? 'unsure' : 'none' };
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
export function needsLookup(row, now = Date.now()) {
  if (!row) return true;
  if (row.status === 'found' || row.status === 'placeholder') return false;
  return now - new Date(row.checked_at).getTime() > RECHECK_DAYS * 86400000;
}
export const PLAYER_PHOTO_BUCKET = 'player-photos';
export const MAX_PLAYER_PHOTO = 512 * 1024;
