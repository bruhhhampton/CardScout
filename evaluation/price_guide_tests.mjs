// Run: node evaluation/price_guide_tests.mjs   (no network; product names in the format the API returned on 5 Nov 2026, prices invented)
import assert from 'node:assert/strict';
import { buildQuery, gradeField, parseProductName, pickProduct, summariseProduct, variantsFor } from '../lib/price-guide.mjs';

const base64 = { player: 'Lamine Yamal', year: 2023, set_name: 'Topps Chrome UEFA Club Competitions', card_number: '64', variant: 'Base', grade_condition: 'Ungraded' };
const silver70 = { player: 'Lamine Yamal', year: 2026, set_name: 'Panini Prizm FIFA World Cup', card_number: '#70', variant: 'Silver Prizm', grade_condition: 'Ungraded' };

// The searches that found the right card in Daniel's live test.
assert.equal(buildQuery(base64), 'Lamine Yamal 64 Topps Chrome UEFA');
assert.equal(buildQuery(silver70), 'Lamine Yamal 70 Panini Prizm FIFA silver');

assert.deepEqual(parseProductName('Lamine Yamal [Silver] #70'), { name: 'Lamine Yamal', variant: 'Silver', number: '70' });
assert.deepEqual(parseProductName('Lamine Yamal #64'), { name: 'Lamine Yamal', variant: '', number: '64' });

const list64 = [
  { id: '1', 'product-name': 'Lamine Yamal [Refractor] #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { id: '2', 'product-name': 'Lamine Yamal #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { id: '3', 'product-name': 'Lamine Yamal #74', 'console-name': 'Funko POP Soccer' },
];
assert.equal(pickProduct(list64, base64).product.id, '2', 'base card, not the Refractor');
assert.equal(pickProduct(list64, { ...base64, variant: 'Refractor' }).product.id, '1', 'the Refractor when asked for');
assert.equal(pickProduct(list64, { ...base64, year: 2024 }).product, null, 'wrong year: no match');
const list70 = [
  { id: '9', 'product-name': 'Lamine Yamal [Disco] #70', 'console-name': 'Soccer Cards 2026 Panini Prizm FIFA' },
  { id: '8', 'product-name': 'Lamine Yamal [Silver] #70', 'console-name': 'Soccer Cards 2026 Panini Prizm FIFA' },
];
assert.equal(pickProduct(list70, silver70).product.id, '8', '"Silver Prizm" matches [Silver], not [Disco]');
const none = pickProduct(list70, { ...silver70, variant: 'Gold /10' });
assert.equal(none.product, null); assert.equal(none.candidates.length, 2);

assert.equal(gradeField('Ungraded').key, 'loose-price');
assert.equal(gradeField('PSA 10').key, 'manual-only-price');
assert.equal(gradeField('BGS 9.5').key, 'box-only-price');
assert.equal(gradeField('PSA 9').key, 'graded-price');
assert.equal(gradeField('Mystery grade'), null);

const s = summariseProduct({ id: '8', 'product-name': 'Lamine Yamal [Silver] #70', 'console-name': 'Soccer Cards 2026 Panini Prizm FIFA', 'loose-price': 10000, 'retail-loose-buy': 5000, 'retail-loose-sell': 11000, 'sales-volume': '300' }, silver70, { rate: 1.5, adjust: 0.85 });
assert.equal(s.value_usd, 100); assert.equal(s.value_aud, 127.5);
assert.equal(s.suggested_buy_aud, 63.75); assert.equal(s.sales_per_year, 300);
assert.equal(s.link, 'https://www.pricecharting.com/game/8');
const graded = summariseProduct({ id: '8', 'manual-only-price': 50000 }, { ...silver70, grade_condition: 'PSA 10' }, { rate: 1.5 });
assert.equal(graded.value_aud, 750); assert.equal(graded.suggested_buy_aud, null, 'no suggested buy price for PSA 10');

// Scanning: the versions of the same card, Base first, other players and numbers left out.
const vs = variantsFor([
  { 'product-name': 'Lamine Yamal [Silver] #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { 'product-name': 'Lamine Yamal #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { 'product-name': 'Lamine Yamal [Gold] #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { 'product-name': 'Lamine Yamal #70', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { 'product-name': 'Pedri #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { 'product-name': 'Lamine Yamal #64', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' },
], { player: 'Lamine Yamal', card_number: '64', year: '2023' });
assert.deepEqual(vs.map((v) => v.variant), ['Base', 'Gold', 'Silver']);
assert.ok(vs.every((v) => 'id' in v));

// Long scanned versions still find the card: serials, "numbered", "parallel" and "RC logo" are ignored,
// and a single close version ("Green Wave" vs "Green Wave Refractor") is accepted and flagged.
const brunner = [
  { id: 1, 'product-name': 'Paris Brunner #44', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' },
  { id: 2, 'product-name': 'Paris Brunner [Green Wave] #44', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' },
  { id: 3, 'product-name': 'Paris Brunner [Gold] #44', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' },
];
const long = pickProduct(brunner, { player: 'Paris Brunner', card_number: '44', year: '2024', variant: 'Green wave parallel, numbered 218/399 (RC logo)' });
assert.equal(long.product.id, 2);
assert.equal(long.exact, true);
// A similar version ("Green Wave" vs "Green Wave Refractor") is never used for the price, only suggested.
const similar = pickProduct([{ id: 9, 'product-name': 'Paris Brunner [Green Wave Refractor] #44', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' }], { player: 'Paris Brunner', card_number: '44', year: '2024', variant: 'Green Wave' });
assert.equal(similar.product, null);
assert.match(similar.similar[0], /Green Wave Refractor/);
// Another player's or number's card is not suggested.
const other = pickProduct([{ id: 11, 'product-name': 'Pedri [Green Wave Refractor] #44', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' }], { player: 'Paris Brunner', card_number: '44', year: '2024', variant: 'Green Wave' });
assert.equal(other.similar, undefined);

console.log('Price guide checks passed (no network used).');
