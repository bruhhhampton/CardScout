// Run: node evaluation/explain_tests.mjs   (synthetic cases, no network)
import assert from 'node:assert/strict';
import { headline, holdUps, ladder, marketValue, sellerWords, whyLines } from '../lib/explain.mjs';

const offer = { player: 'Lamine Yamal', variant: 'Base', asking_price_aud: 48 };
const run = { price_guide: { found: true, value_aud: 48.66, sales_per_year: 440 } };
const counter = { outcome: 'counteroffer', offer_ceiling_aud: 36.49, sales_count: 0, median_sold_aud: null,
  football_real: 92, score_collector: 90, rookie_card: 'yes', first_team: 'yes',
  reasons: ['Market value from the SportsCardsPro price guide: $48.66', 'Asking $48.00 is above your offer ceiling of $36.49; counteroffer up to $36.49'] };

assert.equal(headline(counter, 48).title, 'Offer up to $36.49');
assert.equal(headline({ outcome: 'owner_review' }, 48).title, 'Ask Cerf first');
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
assert.deepEqual(holdUps(counter), ['The seller wants $48.00, more than the most Cerf pays for it ($36.49).'], 'the price guide note is not a hold-up');
assert.equal(holdUps({ outcome: 'eligible', reasons: ['x'] }).length, 0);
const words = sellerWords(counter, 48);
assert.match(words, /best we can offer is \$36\.49/);
assert.ok(!/48\.66|margin|CERF|SportsCardsPro|score/i.test(words), 'no internal numbers or the price guide in seller words');
assert.equal(whyLines({ outcome: 'decline', reasons: [] }, offer, null).length, 2, 'missing scores are skipped, not crashed');
console.log('Explanation checks passed.');
