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
console.log(`${cases.length} synthetic assessment checks passed. Real owner rules and live data not tested.`);
