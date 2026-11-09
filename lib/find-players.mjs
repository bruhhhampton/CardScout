// Find players: plain helpers with no database, so they can be tested.
// Football Manager game ratings are used only to find candidates. They never value a card or change a verdict.

// Football Manager writes positions like "AM/ST R" or "D/WB/M RC". These turn the plain choices into
// patterns on those codes (Postgres regular expressions, case-insensitive).
export const POSITIONS = {
  striker: { label: 'Striker', re: '(^|/)ST( |/|$)' },
  attacker: { label: 'Winger or attacking mid', re: '(^|/)AM( |/|$)' },
  midfielder: { label: 'Midfielder', re: '(^|/)(DM|M)( |/|$)' },
  defender: { label: 'Defender or wing-back', re: '(^|/)(D|WB)( |/|$)' },
  keeper: { label: 'Goalkeeper', re: '^GK' },
};

// Ratings out of 20 that can be searched (database/015 added the defending ones).
export const RATINGS = {
  pace: 'Pace', acceleration: 'Acceleration', finishing: 'Finishing', off_the_ball: 'Off the ball', dribbling: 'Dribbling',
  crossing: 'Crossing', passing: 'Passing', vision: 'Vision', work_rate: 'Work rate', tackling: 'Tackling',
  jumping: 'Jumping reach', positioning: 'Positioning', heading: 'Heading', marking: 'Marking', strength: 'Strength',
};

// Each position shows the three ratings that matter most for it (Luka's suggestion, 9 Nov 2026).
// "extra" ratings can still be used by the scout and More like him, but are not shown as boxes.
// There are no goalkeeping ratings (handling, reflexes) in the data, so goalkeepers are searched by
// age, nationality and club only.
export const POSITION_RATINGS = {
  '': { show: ['pace', 'finishing'], extra: [], sort: 'pace' },
  striker: { show: ['finishing', 'off_the_ball', 'pace'], extra: ['heading', 'acceleration', 'dribbling'], sort: 'finishing' },
  attacker: { show: ['pace', 'dribbling', 'crossing'], extra: ['acceleration', 'finishing', 'vision'], sort: 'pace' },
  midfielder: { show: ['passing', 'vision', 'work_rate'], extra: ['dribbling', 'tackling', 'pace'], sort: 'passing' },
  defender: { show: ['tackling', 'jumping', 'positioning'], extra: ['heading', 'marking', 'strength', 'pace', 'crossing'], sort: 'tackling' },
  keeper: { show: [], extra: [], sort: 'age_snapshot' },
};
const allowed = (position) => [...POSITION_RATINGS[position].show, ...POSITION_RATINGS[position].extra];
export const ratingsApply = (position) => POSITION_RATINGS[position ?? '']?.show.length > 0;
export const shownRatings = (position) => POSITION_RATINGS[position ?? '']?.show ?? [];
export const sortsFor = (position) => [...shownRatings(position), 'age_snapshot'];
export const SORT_LABEL = (k) => (k === 'age_snapshot' ? 'Youngest first' : RATINGS[k]);

const ROLE = { GK: 'Goalkeeper', D: 'Defender', WB: 'Wing-back', DM: 'Defensive midfielder', M: 'Midfielder', AM: 'Attacking midfielder', ST: 'Striker' };
const SIDE = { R: 'right', L: 'left', C: 'centre' };

// "AM/ST R" -> "Attacking midfielder, Striker (right)"
export function positionLabel(code) {
  const t = String(code ?? '').trim();
  if (!t) return '';
  const m = t.match(/^([A-Z/]+)\s*([RLC]*)$/i);
  if (!m) return t;
  const roles = m[1].split('/').map((r) => ROLE[r.toUpperCase()] ?? r).join(', ');
  const sides = [...m[2].toUpperCase()].map((c) => SIDE[c]).filter(Boolean);
  return sides.length ? `${roles} (${sides.join(', ')})` : roles;
}

const int = (v, lo, hi) => {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const text = (v) => String(v ?? '').trim().slice(0, 40);

// Turns the search form into safe filters. Anything invalid, or not suited to the position, is ignored.
// mins: { rating: minimum } using the URL fields min_<rating>.
export function readFilters(sp) {
  const get = (k) => (typeof sp?.get === 'function' ? sp.get(k) : sp?.[k]);
  const position = Object.hasOwn(POSITIONS, String(get('position') ?? '')) ? get('position') : '';
  const mins = {};
  for (const r of allowed(position)) {
    const n = int(get(`min_${r}`), 1, 20);
    if (n) mins[r] = n;
  }
  const wanted = String(get('sort') ?? '');
  const sort = [...allowed(position), 'age_snapshot'].includes(wanted) && (ratingsApply(position) || wanted === 'age_snapshot') ? wanted : POSITION_RATINGS[position].sort;
  return { position, maxAge: int(get('max_age'), 15, 45), mins, nationality: text(get('nationality')), club: text(get('club')), sort };
}

export const hasFilters = (f) => Boolean(f.position || f.maxAge || Object.keys(f.mins ?? {}).length || f.nationality || f.club);

// "More like him": the same position, about the same age or younger, and nearly as good (within 2)
// on the three ratings that matter for that position.
export function similarQuery(p) {
  const code = String(p?.position ?? '');
  const position = /(^|\/)ST( |\/|$)/i.test(code) ? 'striker' : /(^|\/)AM( |\/|$)/i.test(code) ? 'attacker'
    : /(^|\/)(DM|M)( |\/|$)/i.test(code) ? 'midfielder' : /(^|\/)(D|WB)( |\/|$)/i.test(code) ? 'defender' : /^GK/i.test(code) ? 'keeper' : '';
  const q = new URLSearchParams();
  if (position) q.set('position', position);
  if (Number.isFinite(Number(p?.age_snapshot)) && p?.age_snapshot !== null) q.set('max_age', String(Math.min(45, Number(p.age_snapshot) + 1)));
  const shown = shownRatings(position);
  for (const r of shown) if (Number(p?.[r]) > 0) q.set(`min_${r}`, String(Math.max(1, Number(p[r]) - 2)));
  q.set('sort', shown.some((r) => Number(p?.[r]) > 0) ? POSITION_RATINGS[position].sort : 'age_snapshot');
  return q.toString();
}
