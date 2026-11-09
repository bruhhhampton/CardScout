// The owner's decisions: checks, wording and matching to new cards. Plain code, no database.
import { samePlayer } from './price-guide.mjs';

export const DECISIONS = { buy: 'Buy', dont_buy: "Don't buy", offer: 'Offer' };
// What CardScout's verdict would be for the same decision.
const SAME_AS = { buy: 'eligible', dont_buy: 'decline', offer: 'counteroffer' };
const SUGGESTED = { eligible: 'OK to buy', decline: "Don't buy", counteroffer: 'Counteroffer', owner_review: 'Ask the owner' };

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

// Checks what the owner entered. asking is the seller's asking price.
export function validateDecision(values, asking) {
  const errors = {};
  const decision = String(values.decision ?? '').trim();
  if (!DECISIONS[decision]) errors.decision = 'Pick Buy, Don\'t buy or Offer.';
  let offer_aud = null;
  if (decision === 'offer') {
    const raw = String(values.offer_aud ?? '').trim().replace(/^\$/, '');
    const n = Number(raw);
    if (!raw) errors.offer_aud = 'Enter how much to offer.';
    else if (!/^\d+(\.\d{1,2})?$/.test(raw) || !(n > 0) || n > 1000000) errors.offer_aud = 'Enter an amount in dollars, for example 80.';
    else if (asking != null && n >= Number(asking)) errors.offer_aud = `That is the asking price or more. Tap Buy instead.`;
    else offer_aud = n;
  }
  const reason = String(values.reason ?? '').trim().replace(/\s+/g, ' ');
  if (reason.length > 300) errors.reason = 'Keep the reason under 300 characters.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { decision, offer_aud, reason } };
}

export function decisionText(d) {
  if (!d) return '';
  return d.decision === 'offer' ? `Offer ${money(d.offer_aud)}` : DECISIONS[d.decision] ?? '';
}

// Did the owner do what CardScout suggested? 'agreed', 'differed' or 'asked' (CardScout asked him).
export function compareWithSuggestion(d) {
  if (!d?.suggested || d.suggested === 'owner_review') return 'asked';
  return SAME_AS[d.decision] === d.suggested ? 'agreed' : 'differed';
}

export function comparisonText(d) {
  const c = compareWithSuggestion(d);
  if (c === 'asked') return 'CardScout asked the owner';
  return `${c === 'agreed' ? 'Same as' : 'CardScout said'} ${SUGGESTED[d.suggested]}`;
}

// The words staff say to the seller once the owner has decided. No prices, scores or margins
// from the price guide: only the owner's own offer.
export function ownerSellerWords(d, asking) {
  switch (d?.decision) {
    case 'buy': return `Thanks, we can take this card at your price of ${money(asking)}.`;
    case 'offer': return `Thanks for waiting. The owner has had a look, and the best we can offer is ${money(d.offer_aud)}.`;
    case 'dont_buy': return "Thanks for waiting. The owner has had a look, and it isn't a card we're buying at the moment.";
    default: return '';
  }
}

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase() && String(a ?? '').trim() !== '';

// Up to n past decisions on cards like this one, best match first, each with why it matched.
// Same player counts most, then the same set and version, then the same set at a similar price.
export function similarDecisions(offer, decisions, n = 3) {
  const asking = Number(offer.asking_price_aud);
  const scored = [];
  for (const d of decisions ?? []) {
    if (d.offer_id === offer.id) continue;
    const player = samePlayer(offer.player, d.player);
    const set = same(offer.set_name, d.set_name);
    const version = set && same(offer.variant, d.variant);
    const near = asking > 0 && Number(d.asking_price_aud) > 0 && Math.abs(Number(d.asking_price_aud) - asking) / asking <= 0.3;
    let score = 0;
    const why = [];
    if (player) { score += 4; why.push('Same player'); }
    if (version) { score += 2; why.push('same set and version'); }
    else if (set && near) { score += 1; why.push('same set, similar price'); }
    if (!score) continue;
    scored.push({ ...d, why: why.join(', ').replace(/^./, (c) => c.toUpperCase()), score });
  }
  // Only one decision per earlier card: the latest.
  const seen = new Set();
  return scored
    .sort((a, b) => b.score - a.score || new Date(b.created_at) - new Date(a.created_at))
    .filter((d) => (seen.has(d.offer_id) ? false : seen.add(d.offer_id)))
    .slice(0, n);
}

// What the AI is given: the card, what the owner decided and why. No ids.
export function forAgent(list) {
  return list.map((d) => ({
    card: [d.year, d.set_name, d.variant].filter(Boolean).join(' '),
    player: d.player, asking_price_aud: d.asking_price_aud == null ? null : Number(d.asking_price_aud),
    owner_decided: decisionText(d), owner_reason: d.reason || '(no reason given)',
    cardscout_suggested: SUGGESTED[d.suggested] ?? 'unknown', matched_because: d.why, date: String(d.created_at).slice(0, 10),
  }));
}
