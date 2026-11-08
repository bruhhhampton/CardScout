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

export const SORTS = {
  pace: 'Pace', acceleration: 'Acceleration', finishing: 'Finishing', dribbling: 'Dribbling', age_snapshot: 'Youngest first',
};

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

// Turns the search form into safe filters. Anything invalid is ignored.
export function readFilters(sp) {
  const get = (k) => (typeof sp?.get === 'function' ? sp.get(k) : sp?.[k]);
  const position = Object.hasOwn(POSITIONS, String(get('position') ?? '')) ? get('position') : '';
  const sort = Object.hasOwn(SORTS, String(get('sort') ?? '')) ? get('sort') : 'pace';
  return {
    position,
    maxAge: int(get('max_age'), 15, 45),
    minPace: int(get('min_pace'), 1, 20),
    minFinishing: int(get('min_finishing'), 1, 20),
    nationality: text(get('nationality')),
    club: text(get('club')),
    sort,
  };
}

export const hasFilters = (f) => Boolean(f.position || f.maxAge || f.minPace || f.minFinishing || f.nationality || f.club);

// "More like him": the same kind of player, about the same age or younger, nearly as quick and sharp.
export function similarQuery(p) {
  const code = String(p?.position ?? '');
  const position = /(^|\/)ST( |\/|$)/i.test(code) ? 'striker' : /(^|\/)AM( |\/|$)/i.test(code) ? 'attacker'
    : /(^|\/)(DM|M)( |\/|$)/i.test(code) ? 'midfielder' : /(^|\/)(D|WB)( |\/|$)/i.test(code) ? 'defender' : /^GK/i.test(code) ? 'keeper' : '';
  const around = (v) => (Number.isFinite(Number(v)) ? Math.max(1, Number(v) - 2) : '');
  const q = { position, max_age: Number.isFinite(Number(p?.age_snapshot)) ? Math.min(45, Number(p.age_snapshot) + 1) : '', min_pace: around(p?.pace), min_finishing: position === 'striker' || position === 'attacker' ? around(p?.finishing) : '', sort: Number(p?.pace) >= Number(p?.finishing) ? 'pace' : 'finishing' };
  return new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)])).toString();
}
