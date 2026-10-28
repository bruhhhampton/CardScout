// Cerf's FM role-fit score, ported from his cerf.py (fm_score, roles, PROFILES).
// Plain code, no AI. It measures how well a player's FM26 attributes fit an attacking role.
// In Cerf's model it is 20% of football quality; the other 80% is real-world evidence.
// It is never price evidence and never enough on its own.

export const FM_ATTRS = [
  'dribbling', 'first_touch', 'technique', 'passing', 'finishing', 'decisions', 'vision', 'flair',
  'anticipation', 'off_the_ball', 'composure', 'acceleration', 'pace', 'agility', 'balance',
];

// Role weights, copied from cerf.py PROFILES.
export const PROFILES = {
  WINGER: { dribbling: 18, first_touch: 10, technique: 12, passing: 7, finishing: 5, decisions: 10, vision: 8, flair: 6, anticipation: 3, off_the_ball: 4, composure: 3, acceleration: 5, pace: 3, agility: 4, balance: 2 },
  AM: { dribbling: 10, first_touch: 12, technique: 12, passing: 12, finishing: 4, decisions: 13, vision: 13, flair: 5, anticipation: 5, off_the_ball: 4, composure: 4, acceleration: 2, pace: 1, agility: 2, balance: 1 },
  ST: { dribbling: 7, first_touch: 12, technique: 10, passing: 5, finishing: 14, decisions: 10, vision: 4, flair: 3, anticipation: 10, off_the_ball: 10, composure: 7, acceleration: 3, pace: 2, agility: 2, balance: 1 },
};

export const ROLE_LABEL = { WINGER: 'winger', AM: 'attacking midfielder', ST: 'striker' };

// Same role rules as cerf.py: ordinary MC, DM and wing-backs are not attacking midfielders.
export function roles(position) {
  const p = String(position ?? '').toUpperCase().trim();
  const out = [];
  if (/\b(?:ST|CF)\b/.test(p) || p.includes('前锋')) out.push('ST');
  if (/\b(?:LW|RW|AML|AMR)\b/.test(p) || (p.includes('AM') && /[RL]/.test(p)) || p.includes('边锋')) out.push('WINGER');
  if (/\bAMC\b/.test(p) || p === 'AM' || (p.includes('AM') && p.includes('C')) || p.includes('前腰')) out.push('AM');
  return out;
}

function value(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null; // 0, blank or out of range = unknown
}

function roleScore(player, role) {
  const w = PROFILES[role];
  let num = 0, den = 0, covered = 0;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of FM_ATTRS) {
    const v = value(player?.[k]);
    if (v == null) continue;
    covered += w[k];
    num += (v / 20) * 100 * w[k];
    den += w[k];
  }
  const coverage = covered / total;
  if (coverage < 0.8) return null;
  return { score: Math.round((num / den) * 100) / 100, coverage, role };
}

// Returns { score, role, coverage } for the best-fitting attacking role, or null if the
// player has no attacking role or too few known attributes (cerf.py rule: 80% coverage).
export function fmFit(player) {
  if (!player) return null;
  const options = roles(player.position).map((r) => roleScore(player, r)).filter(Boolean);
  if (!options.length) return null;
  return options.reduce((best, x) => (x.score > best.score ? x : best));
}

// cerf.py: football = 80% real-world football + 20% FM. Without an FM fit, real-world only.
export function combineFootball(real, fit) {
  if (fit == null) return Math.round(real * 100) / 100;
  return Math.round((0.8 * real + 0.2 * fit) * 100) / 100;
}
