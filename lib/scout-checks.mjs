// Checks on the scout's picks, in plain code, so the AI cannot slip anything through.
// A pick is kept only if the player came back from a real player search, any card came back from
// SportsCardsPro for that player, and every source is a page the agent actually found.
import { normaliseUrl } from './agent-checks.mjs';

export function checkPicks(input, { players, cards, known, skipped = new Set() }) {
  const raw = Array.isArray(input?.picks) ? input.picks : [];
  const out = [];
  const seen = new Set();
  for (const p of raw) {
    const player = players.get(String(p?.player_id ?? ''));
    if (!player || seen.has(player.player_id) || skipped.has(player.player_id)) continue;
    seen.add(player.player_id);
    const sources = (Array.isArray(p.sources) ? p.sources : []).filter((u) => known.has(normaliseUrl(u))).slice(0, 4);
    const card = p.card_id ? (cards.get(String(p.card_id)) ?? null) : null;
    out.push({
      player_id: player.player_id,
      name: player.name,
      age: player.age_snapshot,
      club: player.club_snapshot,
      position: player.position,
      why: String(p.why ?? '').slice(0, 300),
      // Real-form claims need a real page; without one the pick is shown as unchecked.
      checked: sources.length > 0,
      sources,
      card: card && card.player_key === player.name.toLowerCase() ? card : null,
    });
    if (out.length === 5) break;
  }
  return { picks: out, summary: String(input?.summary ?? '').slice(0, 600) };
}

// When nobody types a focus, each run looks from a new angle, in turn.
export const ANGLES = [
  'young strikers who are scoring',
  'young wingers with real pace',
  'young attacking and central midfielders',
  'young players in South American leagues',
  'young players in Asian leagues (Japan, Korea, Saudi Arabia and others)',
  'young players in Scandinavian, Dutch, Belgian and Portuguese leagues',
  'teenagers who have just broken into a first team in a top-five league',
  'young players who recently moved up to a bigger club',
];
export const angleFor = (completedRuns) => ANGLES[Math.abs(Number(completedRuns) || 0) % ANGLES.length];

// The scout's history, short: what it searched and who it picked in recent runs.
export function historyFrom(runs) {
  return (Array.isArray(runs) ? runs : []).map((r) => ({
    date: String(r.created_at ?? '').slice(0, 10),
    focus: r.summary || null,
    player_searches: (r.trace ?? []).filter((t) => t.type === 'tool' && t.name === 'search_players' && t.input).map((t) => t.input),
    web_searches: (r.trace ?? []).filter((t) => t.type === 'search').map((t) => t.query),
    picked: (r.picks ?? []).map((p) => p.name),
  }));
}
