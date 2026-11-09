// Run: node evaluation/owner_decisions_tests.mjs
// The owner's decisions: checks, wording and matching to new cards. Fictional test records.
import assert from 'node:assert/strict';
import { compareWithSuggestion, comparisonText, decisionText, forAgent, ownerSellerWords, similarDecisions, validateDecision } from '../lib/owner-decisions.mjs';

// Checks
assert.deepEqual(validateDecision({ decision: 'buy', reason: '  good   player ' }, 100), { ok: true, input: { decision: 'buy', offer_aud: null, reason: 'good player' } });
assert.equal(validateDecision({ decision: '' }, 100).errors.decision, "Pick Buy, Don't buy or Offer.");
assert.equal(validateDecision({ decision: 'sell' }, 100).ok, false);
assert.equal(validateDecision({ decision: 'offer', offer_aud: '' }, 100).errors.offer_aud, 'Enter how much to offer.');
assert.equal(validateDecision({ decision: 'offer', offer_aud: 'abc' }, 100).ok, false);
assert.equal(validateDecision({ decision: 'offer', offer_aud: '80.555' }, 100).ok, false);
assert.match(validateDecision({ decision: 'offer', offer_aud: '100' }, 100).errors.offer_aud, /choose Buy/);
assert.deepEqual(validateDecision({ decision: 'offer', offer_aud: '$80' }, 100).input, { decision: 'offer', offer_aud: 80, reason: '' });
// An offer amount is ignored for Buy and Don't buy.
assert.equal(validateDecision({ decision: 'dont_buy', offer_aud: '50' }, 100).input.offer_aud, null);
assert.equal(validateDecision({ decision: 'buy', reason: 'x'.repeat(301) }, 100).ok, false);

// Wording
assert.equal(decisionText({ decision: 'offer', offer_aud: 80 }), 'Offer $80');
assert.equal(decisionText({ decision: 'offer', offer_aud: '72.5' }), 'Offer $72.50');
assert.equal(decisionText({ decision: 'dont_buy' }), "Don't buy");
assert.equal(compareWithSuggestion({ decision: 'buy', suggested: 'eligible' }), 'agreed');
assert.equal(compareWithSuggestion({ decision: 'buy', suggested: 'decline' }), 'differed');
assert.equal(compareWithSuggestion({ decision: 'offer', suggested: 'owner_review' }), 'asked');
assert.equal(compareWithSuggestion({ decision: 'offer', suggested: null }), 'asked');
assert.equal(comparisonText({ decision: 'buy', suggested: 'decline' }), "CardScout said Don't buy");
assert.equal(comparisonText({ decision: 'dont_buy', suggested: 'decline' }), "Same as Don't buy");
// Seller words never include price guide figures: only the owner's own offer or the asking price.
assert.equal(ownerSellerWords({ decision: 'buy' }, 90), 'Thanks, we can take this card at your price of $90.');
assert.match(ownerSellerWords({ decision: 'offer', offer_aud: 70 }, 90), /best we can offer is \$70\./);
assert.doesNotMatch(ownerSellerWords({ decision: 'dont_buy' }, 90), /\$/);

// Matching past decisions to a new card
const offer = { id: 'new', player: 'Min-hyeok Yang', set_name: 'Demo Football Set', variant: 'Base', asking_price_aud: 100 };
const past = [
  { id: 'a', offer_id: 'o1', created_at: '2026-11-01', decision: 'buy', player: 'Yang Min-hyeok', set_name: 'Other Set', variant: 'Gold', asking_price_aud: 300 },
  { id: 'b', offer_id: 'o2', created_at: '2026-11-02', decision: 'dont_buy', player: 'Demo Player B', set_name: 'demo football set', variant: 'base', asking_price_aud: 500 },
  { id: 'c', offer_id: 'o3', created_at: '2026-11-03', decision: 'offer', offer_aud: 60, player: 'Demo Player C', set_name: 'Demo Football Set', variant: 'Silver', asking_price_aud: 110 },
  { id: 'd', offer_id: 'o4', created_at: '2026-11-04', decision: 'buy', player: 'Demo Player D', set_name: 'Demo Football Set', variant: 'Silver', asking_price_aud: 400 },
  { id: 'e', offer_id: 'o5', created_at: '2026-11-05', decision: 'buy', player: 'Someone Else', set_name: 'Another Set', variant: 'Base', asking_price_aud: 100 },
  { id: 'f', offer_id: 'new', created_at: '2026-11-06', decision: 'buy', player: 'Min-hyeok Yang', set_name: 'Demo Football Set', variant: 'Base', asking_price_aud: 100 },
  // An older decision on the same earlier card: only the latest counts.
  { id: 'a0', offer_id: 'o1', created_at: '2026-10-01', decision: 'dont_buy', player: 'Yang Min-hyeok', set_name: 'Other Set', variant: 'Gold', asking_price_aud: 300 },
];
const sim = similarDecisions(offer, past);
assert.deepEqual(sim.map((d) => d.id), ['a', 'b', 'c'], 'same player first, then same set and version, then same set at a similar price');
assert.equal(sim[0].why, 'Same player');
assert.equal(sim[1].why, 'Same set and version');
assert.equal(sim[2].why, 'Same set, similar price');
assert.ok(!sim.some((d) => d.offer_id === 'new'), 'never matches the card itself');
assert.ok(!similarDecisions(offer, past).some((d) => d.id === 'd' || d.id === 'e'), 'same set at a far price, or nothing in common, is left out');
assert.deepEqual(similarDecisions(offer, []), []);
assert.equal(similarDecisions(offer, past, 1).length, 1);

// What the AI sees: no ids, a reason placeholder when none was given.
const ai = forAgent(sim);
assert.equal(ai[0].owner_decided, 'Buy');
assert.equal(ai[0].owner_reason, '(no reason given)');
assert.ok(!('id' in ai[0]) && !('offer_id' in ai[0]));

console.log('Owner decision tests passed.');

// ---------------------------------------------------------------------------
// Learning from the owner
import { applyLearned, blockedBy, learnedCap, learnedList, learnedRuleFor, ruleSuggestions, rulesHit, sameCard } from '../lib/owner-decisions.mjs';

const S = { staff_limit_aud: 150, max_copies: 2, excluded_sets: '', base_rule: 'decline', rookie_only: true, updated_at: '2026-11-01T00:00:00Z' };
const yamal = { id: 'y2', player: 'Lamine Yamal', year: 2023, set_name: 'Topps Chrome', variant: 'Base', asking_price_aud: 45 };
const okInput = { condition: 'acceptable', stock_count: 0, first_team: 'yes' };
const declined = { outcome: 'decline', reasons: ["Base card: your setting is to not buy them"], offer_ceiling_aud: 42.94 };
const offer35 = { id: 'r1', offer_id: 'y1', created_at: '2026-11-09T03:00:00Z', decision: 'offer', offer_aud: 35, reason: 'small offer only', player: 'Yamal Lamine', year: 2023, set_name: 'topps chrome', variant: 'base', asking_price_aud: 48 };

// Same card: any name order, case; year, set and version must match.
assert.ok(sameCard(yamal, offer35));
assert.ok(!sameCard({ ...yamal, year: 2024 }, offer35), 'another year is another card');
assert.ok(!sameCard({ ...yamal, variant: 'Refractor' }, offer35));
assert.ok(!sameCard({ ...yamal, set_name: 'Topps Chrome UCC' }, offer35));
assert.ok(sameCard({ ...yamal, variant: '' }, offer35), 'an empty version counts as base');

// Which decision applies
assert.equal(learnedRuleFor(yamal, [offer35])?.id, 'r1');
assert.equal(learnedRuleFor(yamal, [{ ...offer35, learn: false }]), null, 'the owner turned "do the same" off');
assert.equal(learnedRuleFor(yamal, [{ ...offer35, forgotten_at: '2026-11-10' }]), null, 'removed in Settings');
assert.equal(learnedRuleFor({ ...yamal, id: 'y1' }, [offer35]), null, 'never learns from the card itself');
// His latest decision on that earlier card wins, even if it was not learned.
assert.equal(learnedRuleFor(yamal, [offer35, { ...offer35, id: 'r2', created_at: '2026-11-09T04:00:00Z', learn: false }]), null);
const newer = { ...offer35, id: 'r3', offer_id: 'y3', created_at: '2026-11-09T05:00:00Z', decision: 'buy', offer_aud: null, asking_price_aud: 50 };
assert.equal(learnedRuleFor(yamal, [offer35, newer]).id, 'r3', 'newest decision on the same card');

// Offer $35 learned: asking 45 -> counteroffer up to 35; asking 30 -> OK to buy.
let r = applyLearned(declined, yamal, okInput, S, offer35);
assert.equal(r.outcome, 'counteroffer');
assert.equal(r.offer_ceiling_aud, 35);
assert.equal(r.learned_from, 'r1');
assert.match(r.reasons[0], /^Learned from the owner: he offered \$35\.00 for this card on 9 Nov \("small offer only"\)/);
r = applyLearned(declined, { ...yamal, asking_price_aud: 30 }, okInput, S, offer35);
assert.equal(r.outcome, 'eligible');
assert.equal(r.reasons.at(-1), 'A person must still confirm before buying');
// Buy at $50 learned: never pays more than he did.
assert.equal(applyLearned(declined, { ...yamal, asking_price_aud: 50 }, okInput, S, newer).outcome, 'eligible');
r = applyLearned(declined, { ...yamal, asking_price_aud: 60 }, okInput, S, newer);
assert.equal(r.outcome, 'counteroffer');
assert.equal(r.offer_ceiling_aud, 50);
// Never over the staff limit.
assert.equal(learnedCap({ decision: 'buy', asking_price_aud: 400 }, S), 150);
r = applyLearned(declined, { ...yamal, asking_price_aud: 300 }, okInput, S, { ...newer, asking_price_aud: 400 });
assert.equal(r.outcome, 'counteroffer');
assert.equal(r.offer_ceiling_aud, 150);
// Don't buy learned
r = applyLearned({ outcome: 'owner_review', reasons: ['x'] }, yamal, okInput, S, { ...offer35, decision: 'dont_buy', offer_aud: null, reason: '' });
assert.equal(r.outcome, 'decline');
assert.deepEqual(r.reasons, ["Learned from the owner: he said don't buy this card on 9 Nov"]);
// Facts about this copy stop it, and the reason says why.
for (const [input, s2, o] of [[{ ...okInput, condition: 'unsure' }, S, yamal], [{ ...okInput, condition: 'defect' }, S, yamal],
  [{ ...okInput, stock_count: 2 }, S, yamal], [{ ...okInput, first_team: 'no' }, S, yamal], [okInput, { ...S, excluded_sets: 'Topps Chrome' }, yamal]]) {
  const res = applyLearned(declined, o, input, s2, offer35);
  assert.equal(res.outcome, 'decline');
  assert.ok(!res.learned_from);
  assert.match(res.reasons.at(-1), /was not used because/);
  assert.ok(blockedBy(input, s2, o));
}
assert.equal(applyLearned(declined, yamal, okInput, S, null), declined, 'nothing learned: unchanged');

// Settings list: one per card, newest, active only.
const list = learnedList([offer35, newer, { ...offer35, id: 'r9', offer_id: 'y9', player: 'Someone Else', forgotten_at: 'x' }]);
assert.deepEqual(list.map((d) => d.id), ['r3']);

// Which rules flagged the card when he decided.
assert.deepEqual(rulesHit(yamal, { condition: 'acceptable', rookie_card: 'no' }, S), ['base_rule', 'rookie_only']);
assert.deepEqual(rulesHit(yamal, null, S), []);

// Suggest changing a rule after 3 decisions against it since Settings were last saved.
const against = (i, extra = {}) => ({ id: `s${i}`, offer_id: `o${i}`, created_at: `2026-11-0${i + 2}T00:00:00Z`, decision: 'buy', rules_hit: ['base_rule'], ...extra });
assert.deepEqual(ruleSuggestions([against(1), against(2)], S), []);
const sug = ruleSuggestions([against(1), against(2), against(3)], S);
assert.equal(sug.length, 1);
assert.equal(sug[0].rule, 'base_rule');
assert.deepEqual(sug[0].change, { base_rule: 'ask', label: 'Ask me about them instead' });
assert.match(sug[0].text, /3 base cards that your rule turns away/);
assert.equal(ruleSuggestions([against(1), against(2), against(3)], { ...S, base_rule: 'ask' })[0].change.base_rule, 'allow');
assert.deepEqual(ruleSuggestions([against(1), against(2), against(3)], { ...S, base_rule: 'allow' }), [], 'rule already off');
assert.deepEqual(ruleSuggestions([against(1), against(2), against(3, { decision: 'dont_buy' })], S), [], 'only buys and offers count');
assert.deepEqual(ruleSuggestions([against(1), against(2), against(3)], { ...S, updated_at: '2026-11-08T00:00:00Z' }), [], 'saving Settings resets the count');

console.log('Learning tests passed.');
