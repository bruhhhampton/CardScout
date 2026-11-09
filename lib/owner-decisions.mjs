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
    else if (asking != null && n >= Number(asking)) errors.offer_aud = 'That is the asking price or more. To pay the asking price, choose Buy.';
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

// ---------------------------------------------------------------------------
// Learning from the owner. A decision he leaves "Use this next time" on becomes a learned rule
// for the same card: same player, year, set and version. Plain code: the same decisions always
// give the same verdict, and every change says which decision it came from.

import { excludedList, shopFlags } from './assess.mjs';

const floorCents = (n) => Math.floor((n + 1e-9) * 100) / 100;
const shortDate = (d) => new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' });

export const isLearned = (d) => d.learn !== false && !d.forgotten_at;

// The same card: same player (any name order or spelling), year, set and version.
export function sameCard(offer, d) {
  if (!samePlayer(offer.player, d.player)) return false;
  if (!same(offer.set_name, d.set_name)) return false;
  const v = (x) => String(x ?? '').trim().toLowerCase() || 'base';
  if (v(offer.variant) !== v(d.variant)) return false;
  if (offer.year != null && d.year != null && Number(offer.year) !== Number(d.year)) return false;
  return true;
}

// Only the owner's latest decision on each earlier card counts.
function latestPerOffer(decisions) {
  const seen = new Set();
  return [...(decisions ?? [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter((d) => (seen.has(d.offer_id) ? false : seen.add(d.offer_id)));
}

// The learned rule for this card, or null: his newest decision on the same card that he
// left on "Use this next time" and has not removed.
export function learnedRuleFor(offer, decisions) {
  return latestPerOffer(decisions).find((d) => d.offer_id !== offer.id && isLearned(d) && sameCard(offer, d)) ?? null;
}

// Facts about this particular copy that an earlier decision cannot know about.
export function blockedBy(input, s, offer = {}) {
  if (excludedList(s.excluded_sets).includes(String(offer.set_name ?? '').trim().toLowerCase())) return 'the set is now on your excluded list';
  if (['not_acceptable', 'unsure', 'defect'].includes(input.condition)) return 'the condition of this copy needs checking';
  if (Number(input.stock_count) + 1 > Number(s.max_copies)) return 'the shop already holds enough copies';
  if (input.first_team === 'no') return 'the player no longer has a first-team chance';
  return null;
}

// The most CardScout pays because of a learned rule: never more than the owner did, never over the staff limit.
export function learnedCap(rule, s) {
  const paid = rule.decision === 'offer' ? Number(rule.offer_aud) : Number(rule.asking_price_aud);
  if (!(paid > 0)) return null;
  return floorCents(Math.min(paid, Number(s.staff_limit_aud)));
}

// Changes the rules' verdict to follow a learned decision. Returns the result unchanged when
// there is no rule or a fact about this copy stops it.
export function applyLearned(result, offer, input, s, rule) {
  if (!rule) return result;
  const why = blockedBy(input, s, offer);
  const when = shortDate(rule.created_at);
  const said = rule.reason ? ` ("${rule.reason}")` : '';
  if (why) return { ...result, reasons: [...result.reasons, `The owner decided this card on ${when}, but that was not used because ${why}`] };
  const asking = Number(offer.asking_price_aud);
  const base = { ...result, learned_from: rule.id };
  if (rule.decision === 'dont_buy') {
    return { ...base, outcome: 'decline', offer_ceiling_aud: result.offer_ceiling_aud, reasons: [`Learned from the owner: he said don't buy this card on ${when}${said}`] };
  }
  const cap = learnedCap(rule, s);
  if (cap == null) return result;
  const did = rule.decision === 'buy' ? `bought this card at $${Number(rule.asking_price_aud).toFixed(2)}` : `offered $${Number(rule.offer_aud).toFixed(2)} for this card`;
  const first = `Learned from the owner: he ${did} on ${when}${said}`;
  if (asking <= cap) {
    return { ...base, outcome: 'eligible', offer_ceiling_aud: cap, reasons: [first, `Asking $${asking.toFixed(2)} is within that`, 'A person must still confirm before buying'] };
  }
  return { ...base, outcome: 'counteroffer', offer_ceiling_aud: cap, reasons: [first, `Asking $${asking.toFixed(2)} is above that; counteroffer up to $${cap.toFixed(2)}`] };
}

// The owner's active learned rules, one per card, newest first (for Settings).
export function learnedList(decisions) {
  const out = [];
  for (const d of latestPerOffer(decisions)) {
    if (!isLearned(d)) continue;
    if (out.some((x) => sameCard(x, d))) continue;
    out.push(d);
  }
  return out;
}

// Which of the owner's rules flagged this card when he decided it.
export function rulesHit(offer, assessment, s) {
  if (!assessment || !s) return [];
  const flags = shopFlags(offer, { condition: assessment.condition, sales_per_year: null }, s).map((f) => f.rule);
  if (s.rookie_only !== false && assessment.rookie_card === 'no') flags.push('rookie_only');
  return flags;
}

export const RULE_WORDS = {
  base_rule: { what: 'base cards', setting: 'Base cards' },
  maker_rule: { what: 'cards from makers you do not list', setting: 'Cards from other makers' },
  price_rule: { what: 'expensive cards', setting: 'Expensive cards' },
  defect_rule: { what: 'cards with a defect', setting: 'Cards with a defect' },
  rookie_only: { what: 'cards that are not rookie cards', setting: 'Only buy recognised rookie cards' },
};
export const SUGGEST_AFTER = 3;

// When the owner keeps buying cards one of his rules flags, suggest changing that rule.
// Only decisions since he last saved Settings count, so keeping the rule quietens it.
export function ruleSuggestions(decisions, s) {
  if (!s) return [];
  const since = s.updated_at ? new Date(s.updated_at) : new Date(0);
  const recent = latestPerOffer(decisions).filter((d) => new Date(d.created_at) > since && ['buy', 'offer'].includes(d.decision));
  const out = [];
  for (const rule of Object.keys(RULE_WORDS)) {
    const current = rule === 'rookie_only' ? (s.rookie_only !== false ? 'on' : 'off') : s[rule] ?? 'allow';
    if (current === 'allow' || current === 'off') continue;
    const hits = recent.filter((d) => (d.rules_hit ?? []).includes(rule));
    if (hits.length < SUGGEST_AFTER) continue;
    const change = rule === 'rookie_only'
      ? { rookie_only: false, label: 'Stop requiring rookie cards' }
      : current === 'decline'
        ? { [rule]: 'ask', label: 'Ask me about them instead' }
        : { [rule]: 'allow', label: 'Let CardScout judge them' };
    out.push({ rule, count: hits.length, current, change, text: `You bought or made offers on ${hits.length} ${RULE_WORDS[rule].what} that your rule ${current === 'decline' ? 'turns away' : 'sends to you'}.` });
  }
  return out;
}
