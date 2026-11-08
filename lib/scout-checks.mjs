// Checks on the scout's picks, in plain code, so the AI cannot slip anything through.
// A pick is kept only if the player came back from a real player search, any card came back from
// SportsCardsPro for that player, and every source is a page the agent actually found.
import { normaliseUrl } from './agent-checks.mjs';

export function checkPicks(input, { players, cards, known }) {
  const raw = Array.isArray(input?.picks) ? input.picks : [];
  const out = [];
  const seen = new Set();
  for (const p of raw) {
    const player = players.get(String(p?.player_id ?? ''));
    if (!player || seen.has(player.player_id)) continue;
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
