// Run: node evaluation/explain_tests.mjs   (synthetic cases, no network)
import assert from 'node:assert/strict';
import { headline, holdUps, ladder, marketValue, sellerWords, whyLines } from '../lib/explain.mjs';

const offer = { player: 'Lamine Yamal', variant: 'Base', asking_price_aud: 48 };
const run = { price_guide: { found: true, value_aud: 48.66, sales_per_year: 440 } };
const counter = { outcome: 'counteroffer', offer_ceiling_aud: 36.49, sales_count: 0, median_sold_aud: null,
  football_real: 92, score_collector: 90, rookie_card: 'yes', first_team: 'yes',
  reasons: ['Market value from the SportsCardsPro price guide: $48.66', 'Asking $48.00 is above your offer ceiling of $36.49; counteroffer up to $36.49'] };

assert.equal(headline(counter, 48).title, 'Offer up to $36.49');
assert.equal(headline({ outcome: 'owner_review' }, 48).title, 'Ask the owner first');
assert.equal(marketValue(counter, run).from, 'SportsCardsPro price guide');
assert.equal(marketValue({ ...counter, reasons: [], sales_count: 3, median_sold_aud: 50 }, run).value, 50, 'real sales win over the guide');
assert.equal(marketValue({ ...counter, sales_count: 2, median_sold_aud: 150 }, run).value, 48.66, 'the guide when the rules used it');
const l = ladder(counter, run, 48);
assert.deepEqual(l.points.map((p) => p.key), ['max', 'asking', 'worth']);
assert.ok(l.points[0].at < l.points[1].at && l.points[1].at < l.points[2].at, 'max < asking < worth along the line');
const why = whyLines(counter, offer, run);
assert.match(why[0].text, /^Top of his age group \(92\/100\)\. Plays first-team football\.$/);
assert.equal(why[1].text, 'His official rookie card, the common base version.');
assert.match(why[2].text, /Very high collector demand: about 440 sell each year/);
assert.match(why[3].text, /1% below what it is worth/);
assert.deepEqual(holdUps(counter), ['The seller wants $48.00, more than the most the shop pays for it ($36.49).'], 'the price guide note is not a hold-up');
assert.equal(holdUps({ outcome: 'eligible', reasons: ['x'] }).length, 0);
const words = sellerWords(counter, 48);
assert.match(words, /best we can offer is \$36\.49/);
assert.ok(!/48\.66|margin|CERF|SportsCardsPro|score/i.test(words), 'no internal numbers or the price guide in seller words');
assert.equal(whyLines({ outcome: 'decline', reasons: [] }, offer, null).length, 2, 'missing scores are skipped, not crashed');
console.log('Explanation checks passed.');

// Walkthrough: the four steps agree with the verdict.
{
  const { walkthrough } = await import('../lib/explain.mjs');
  const snap = { excluded_sets: '', max_copies: 2, offer_fraction: 0.8, min_margin: 0.25, selling_costs_aud: 0, staff_limit_aud: 150, min_sales: 3, sales_window_days: 90, w_football: 35, w_career: 20, w_collector: 20, w_card: 10, w_valuation: 15, attractive_total_min: 75, attractive_valuation_min: 60 };
  const base = { condition: 'acceptable', rookie_card: 'yes', first_team: 'yes', stock_count: 0, score_football: 92, football_real: 92, fm_fit: null, score_career: 88, score_collector: 90, score_card: 65, score_valuation: 62, cerf_total: 85.7, cerf_category: 'ATTRACTIVE', settings_snapshot: snap };
  const guideRun = { status: 'completed', sales_count: 0, price_guide: { found: true, value_usd: 40, value_aud: 48.65, rate: 1.431, adjust: 0.85, grade: 'Ungraded', link: 'https://example.test' }, draft: { scores: {}, checks: {} } };
  const w = walkthrough({ ...base, outcome: 'counteroffer', offer_ceiling_aud: 36.48, sales_count: 0, median_sold_aud: null, reasons: ['Market value from the SportsCardsPro price guide: $48.65'] }, guideRun, { set_name: 'Topps Chrome UEFA', asking_price_aud: 46 }, {});
  assert.equal(w.length, 4);
  assert.match(w[0].rows[2].text, /official rookie card/);
  assert.match(w[1].rows[0].text, /an ungraded copy at US\$40\.00.*= \$48\.65/);
  assert.match(w[3].maths[0], /80% × \$48\.65 = \$38\.92/);
  assert.match(w[3].maths[2], /\$36\.48/);
  assert.equal(w[3].status, 'check');
  assert.match(w[3].result, /Offer up to \$36\.48/);
  // Too few sales, no price guide: step 2 needs a look.
  const few = walkthrough({ ...base, outcome: 'owner_review', offer_ceiling_aud: 120, sales_count: 2, median_sold_aud: 150, reasons: [] }, { status: 'completed', sales_count: 2, median_sold_aud: 150, draft: {} }, { set_name: 'X', asking_price_aud: 46 }, {});
  assert.equal(few[1].status, 'check');
  assert.match(few[1].result, /Only 2 sales/);
  // A "no" stops the card at step 1; later steps say so.
  const no = walkthrough({ ...base, rookie_card: 'no', outcome: 'decline', offer_ceiling_aud: 120, sales_count: 3, median_sold_aud: 150, reasons: [] }, { status: 'completed', sales_count: 3, median_sold_aud: 150, draft: {} }, { set_name: 'X', asking_price_aud: 46 }, {});
  assert.equal(no[0].status, 'stop');
  assert.equal(no[2].afterStop, 1);
  console.log('Walkthrough checks passed.');
}

