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
assert.match(validateDecision({ decision: 'offer', offer_aud: '100' }, 100).errors.offer_aud, /Tap Buy instead/);
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
