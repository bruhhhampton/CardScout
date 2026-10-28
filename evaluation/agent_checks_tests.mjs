// Run: node evaluation/agent_checks_tests.mjs   (no AI or network used)
import assert from 'node:assert/strict';
import { checkSale, checkDraft, summariseSales, normaliseUrl, urlsInText } from '../lib/agent-checks.mjs';

const known = new Set(['https://www.ebay.com.au/itm/111', 'https://ebay.com.au/itm/222?x=1', 'https://site.com/a'].map(normaliseUrl));
const ok = { price: '150', currency: 'AUD', sold_date: '2026-10-10', url: 'https://ebay.com.au/itm/111', title: 't', exact_match: true, is_lot: false };
const today = '2026-10-21';
const c = (x) => checkSale({ ...ok, ...x }, known, today, 30);

assert.equal(c({}).accepted, true, 'valid sale');
assert.equal(c({ url: 'https://ebay.com.au/itm/999' }).accepted, false, 'invented link rejected');
assert.equal(c({ url: 'not a url' }).accepted, false, 'bad link');
assert.equal(c({ currency: 'USD' }).accepted, false, 'non-AUD');
assert.equal(c({ price: '12.345' }).accepted, false, '3 decimals');
assert.equal(c({ price: '-5' }).accepted, false, 'negative');
assert.equal(c({ price: '0' }).accepted, false, 'zero');
assert.equal(c({ sold_date: '2026-11-01' }).accepted, false, 'future');
assert.equal(c({ sold_date: '2026-08-01' }).accepted, false, 'stale');
assert.equal(c({ sold_date: '10/10/2026' }).accepted, false, 'bad date');
assert.equal(c({ exact_match: false }).accepted, false, 'not exact');
assert.equal(c({ is_lot: true }).accepted, false, 'lot');
assert.equal(c({ url: 'https://EBAY.com.au/itm/222?x=1#frag' }).accepted, true, 'url normalised');

const s = summariseSales([c({ price: '100' }), c({ price: '100' }), c({ url: 'https://site.com/a', price: '200' }), c({ url: 'https://x.com/z', price: '999' })]);
assert.deepEqual(s, { sales_count: 2, median_sold_aud: 150, australian_count: 2, overseas_count: 0 }, 'duplicates and rejected sales ignored');
assert.deepEqual(summariseSales([]), { sales_count: 0, median_sold_aud: null, australian_count: 0, overseas_count: 0 });

// Overseas sales: only when the owner turns them on and enters a rate; converted and adjusted in plain code.
const off = { on: false, adjust: 1, rates: { USD: 1.5 } };
const on = { on: true, adjust: 0.85, rates: { USD: 1.5, GBP: null } };
assert.match(c({ currency: 'USD' }).problems.join(), /switched off/, 'overseas off by default');
assert.equal(checkSale({ ...ok, currency: 'USD' }, known, today, 30, off).accepted, false, 'owner turned overseas off');
const us = checkSale({ ...ok, currency: 'usd', price: '100' }, known, today, 30, on);
assert.equal(us.accepted, true, 'USD counted when on');
assert.equal(us.price, 127.5, '100 USD x 1.5 x 85% = 127.50 AUD');
assert.equal(us.overseas, true);
assert.match(checkSale({ ...ok, currency: 'GBP' }, known, today, 30, on).problems.join(), /no GBP to AUD rate/, 'no rate, not counted');
assert.equal(checkSale({ ...ok, currency: 'AUD', price: '90' }, known, today, 30, on).price, 90, 'AUD unchanged');
const mix = summariseSales([checkSale({ ...ok, price: '90' }, known, today, 30, on), us]);
assert.deepEqual(mix, { sales_count: 2, median_sold_aud: 108.75, australian_count: 1, overseas_count: 1 });

const d = checkDraft({ scores: { football: { score: 85, reason: 'r', sources: ['https://site.com/a', 'https://fake.com'] }, career: { score: 101 } }, questions_for_staff: ['Stock?'] }, known);
assert.deepEqual(d.scores.football.sources, ['https://site.com/a'], 'unseen source dropped');
assert.equal(d.scores.football.flag, null);
assert.equal(d.scores.career.score, null, 'out of range score dropped');
assert.ok(d.scores.collector.flag, 'missing score flagged');
assert.deepEqual(urlsInText('see https://a.com/x and http://b.com/y.'), ['a.com/x', 'b.com/y'].map((u) => normaliseUrl('https://' + u)));
// Cerf's two checks: a sourced answer is kept; an unsourced yes/no becomes unsure; a missing or bad answer is unsure.
const ck = checkDraft({ scores: {}, checks: {
  rookie_card: { answer: 'yes', reason: 'RC logo on the card', sources: ['https://site.com/a'] },
  first_team: { answer: 'no', reason: 'No minutes', sources: ['https://made-up.example/x'] },
} }, known);
assert.equal(ck.checks.rookie_card.answer, 'yes');
assert.equal(ck.checks.rookie_card.flag, null);
assert.equal(ck.checks.first_team.answer, 'unsure');
assert.match(ck.checks.first_team.flag, /No checkable source/);
const none = checkDraft({ scores: {}, checks: { rookie_card: { answer: 'maybe' } } }, known);
assert.equal(none.checks.rookie_card.answer, 'unsure');
assert.equal(none.checks.first_team.answer, 'unsure');
console.log('Agent guardrail checks passed (no AI or network used).');
