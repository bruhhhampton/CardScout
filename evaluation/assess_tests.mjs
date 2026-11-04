// Run: node evaluation/assess_tests.mjs   (synthetic cases only)
import assert from 'node:assert/strict';
import { assess, cerf } from '../lib/assess.mjs';

const s = {
  staff_limit_aud: 150, max_copies: 2, excluded_sets: 'Topps Chrome, Panini Prizm', offer_fraction: 0.8,
  min_margin: 0.25, selling_costs_aud: 20, min_sales: 3, sales_window_days: 30,
  w_football: 35, w_career: 20, w_collector: 20, w_card: 10, w_valuation: 15,
  reject_football_below: 60, speculative_football_below: 65, speculative_career_below: 50,
  expensive_valuation_below: 40, attractive_total_min: 75, attractive_valuation_min: 60,
};
const good = { football: 85, career: 80, collector: 80, card: 70, valuation: 75 };
const offer = { set_name: 'Demo Football Set', asking_price_aud: 120 };
const input = { stock_count: 0, condition: 'acceptable', rookie_card: 'yes', first_team: 'yes', sales_count: 3, median_sold_aud: 200, scores: good };
const run = (o = {}, i = {}) => assess({ ...offer, ...o }, { ...input, ...i, scores: { ...good, ...(i.scores || {}) } }, s);

const cases = [
  ['Eligible', {}, {}, 'eligible', 130],
  ['Counteroffer', { asking_price_aud: 140 }, {}, 'counteroffer', 130],
  ['Exact ceiling', { asking_price_aud: 130 }, {}, 'eligible', 130],
  ['Excluded set (case-insensitive)', { set_name: 'topps chrome' }, {}, 'decline'],
  ['Second excluded set', { set_name: 'Panini Prizm' }, {}, 'decline'],
  ['Stock limit', {}, { stock_count: 2 }, 'decline'],
  ['Condition fails', {}, { condition: 'not_acceptable' }, 'decline'],
  ['Condition unsure', {}, { condition: 'unsure' }, 'owner_review'],
  ['Too few sales', {}, { sales_count: 2 }, 'owner_review'],
  ['No median', {}, { median_sold_aud: null }, 'owner_review'],
  ['CERF reject', {}, { scores: { football: 50 } }, 'decline'],
  ['CERF speculative (football)', {}, { scores: { football: 62 } }, 'owner_review'],
  ['CERF speculative (career)', {}, { scores: { career: 40 } }, 'owner_review'],
  ['CERF watch', {}, { scores: { collector: 40, card: 40 } }, 'owner_review'],
  ['CERF expensive, price ok', {}, { scores: { valuation: 30 } }, 'owner_review'],
  ['CERF expensive, price high', { asking_price_aud: 140 }, { scores: { valuation: 30 } }, 'counteroffer'],
  ['Over staff limit', { asking_price_aud: 180 }, { median_sold_aud: 300 }, 'owner_review', 205],
  ['Counter above staff limit', { asking_price_aud: 250 }, { median_sold_aud: 300 }, 'owner_review', 205],
  ['Exact staff limit', { asking_price_aud: 150 }, { median_sold_aud: 300 }, 'eligible', 205],
  ['Costs too high', {}, { median_sold_aud: 20 }, 'decline'],
  ['Not a rookie card', {}, { rookie_card: 'no' }, 'decline'],
  ['No first-team chance', {}, { first_team: 'no' }, 'decline'],
  ['Rookie card not sure', {}, { rookie_card: 'unsure' }, 'owner_review'],
  ['First-team not sure', {}, { first_team: 'unsure' }, 'owner_review'],
  ['Gate beats good scores and price', { asking_price_aud: 100 }, { rookie_card: 'no' }, 'decline'],
  ['Gate before missing sales', {}, { first_team: 'no', sales_count: 0, median_sold_aud: null }, 'decline'],
  ['Hard rule before missing info', { set_name: 'Topps Chrome' }, { sales_count: 0, median_sold_aud: null }, 'decline'],
];
// With the owner's setting on, the price guide is the card's value whenever it has one (up to the limit).
const guideOn = { ...s, price_guide_as_evidence: true, price_guide_limit_aud: 250 };
const fewSales = { ...input, sales_count: 1, median_sold_aud: 150, price_guide_aud: 200 };
assert.equal(assess(offer, fewSales, s).outcome, 'owner_review', 'Price guide off: too few sales goes to the owner');
const g = assess(offer, fewSales, guideOn);
assert.equal(g.outcome, 'eligible', 'Price guide on: judged on the guide value');
assert.equal(g.price_basis, 'price_guide'); assert.equal(g.market_value_aud, 200);
assert.ok(g.reasons.some((r) => r.startsWith('Market value from the SportsCardsPro price guide')), 'says the price guide was used');
assert.equal(assess(offer, fewSales, { ...guideOn, price_guide_limit_aud: 100 }).outcome, 'owner_review', 'Guide value over the limit: still needs sales');
const always = assess(offer, { ...input, price_guide_aud: 180 }, guideOn);
assert.equal(always.price_basis, 'price_guide', 'Setting on: the guide is used even with enough sales');
assert.equal(always.market_value_aud, 180);
const noGuide = assess(offer, { ...input, price_guide_aud: null }, guideOn);
assert.equal(noGuide.price_basis, 'sales', 'No guide value: real sales are used');
// The rookie card rule can be switched off by the owner.
const sNoRookie = { ...s, rookie_only: false };
assert.equal(assess(offer, { ...input, rookie_card: 'no' }, sNoRookie).outcome, 'eligible', 'Rookie rule off: a non-rookie card is judged on scores and price');
assert.equal(assess(offer, { ...input, rookie_card: 'unsure' }, sNoRookie).outcome, 'eligible', 'Rookie rule off: not sure does not send it to the owner');
assert.equal(assess(offer, { ...input, rookie_card: 'no' }, { ...s, rookie_only: true }).outcome, 'decline', 'Rookie rule on: declined');
assert.equal(assess(offer, { ...input, first_team: 'no' }, sNoRookie).outcome, 'decline', 'Rookie rule off does not switch off the first-team rule');
for (const [label, o, i, outcome, ceiling] of cases) {
  const r = run(o, i);
  assert.equal(r.outcome, outcome, `${label}: got ${r.outcome} (${r.reasons.join('; ')})`);
  if (ceiling !== undefined) assert.equal(r.offer_ceiling_aud, ceiling, label);
  assert.ok(r.reasons.length > 0, `${label}: needs a reason`);
}
assert.equal(cerf(good, s).total, 80);
assert.equal(cerf(good, s).category, 'ATTRACTIVE');
// The Watch reason names only what failed (the Yamal case: total 83.3 is fine, valuation 58 is not).
const yam = cerf({ football: 92, career: 88, collector: 90, card: 68, valuation: 58 }, s);
assert.equal(yam.category, 'WATCH');
assert.equal(yam.reason, 'Valuation 58 is below your attractive level of 60');
const low = cerf({ football: 70, career: 60, collector: 50, card: 50, valuation: 65 }, s);
assert.equal(low.category, 'WATCH');
assert.match(low.reason, /^CERF total \d+\.\d is below your attractive level of 75$/);
const both = cerf({ football: 70, career: 60, collector: 50, card: 50, valuation: 45 }, s);
assert.match(both.reason, /CERF total .* below .*; Valuation 45 is below/);
// FM role fit counts for 20% of football quality (cerf.py); real-world is the other 80%.
const yamal = assess(offer, { ...input, scores: { football: 92, career: 88, collector: 90, card: 68, valuation: 58 }, fm_fit: 84.8, fm_role: 'WINGER' }, s);
assert.equal(yamal.football, 90.56);
assert.equal(yamal.football_real, 92);
assert.equal(yamal.cerf_total, Math.round(((90.56 * 35 + 88 * 20 + 90 * 20 + 68 * 10 + 58 * 15) / 100) * 10) / 10);
const noFm = assess(offer, { ...input, fm_fit: null }, s);
assert.equal(noFm.football, good.football);
// "Speculative" uses the real-world part, as in cerf.py: a strong FM fit cannot hide weak real-world evidence.
const fmHeavy = cerf({ ...good, football: 70.4 }, s, 63);
assert.equal(fmHeavy.category, 'SPECULATIVE');
// "Reject" uses the combined score, as in cerf.py: real 55 + FM 80 = 60, which is not below 60.
assert.notEqual(assess(offer, { ...input, scores: { ...good, football: 55 }, fm_fit: 80 }, s).cerf_category, 'REJECT');
assert.equal(assess(offer, { ...input, scores: { ...good, football: 55 }, fm_fit: null }, s).cerf_category, 'REJECT');
console.log(`${cases.length} synthetic assessment checks passed. Real owner rules and live data not tested.`);
