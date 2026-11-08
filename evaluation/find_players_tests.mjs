// Run: node evaluation/find_players_tests.mjs   (no database or network used)
import assert from 'node:assert/strict';
import { hasFilters, POSITIONS, positionLabel, readFilters } from '../lib/find-players.mjs';
import { cardFromProduct, cardsForPlayer, rankCards } from '../lib/price-guide.mjs';

// Position patterns against real Football Manager codes from the dataset.
const is = (pos, code) => new RegExp(POSITIONS[pos].re, 'i').test(code);
assert.ok(is('striker', 'AM/ST R') && is('striker', 'ST C') && is('striker', 'D/AM/ST RL'));
assert.ok(!is('striker', 'D/WB/M RC') && !is('striker', 'M LC'));
assert.ok(is('attacker', 'D/WB/AM R') && is('attacker', 'AM/ST R') && !is('attacker', 'DM RL'));
assert.ok(is('midfielder', 'DM RL') && is('midfielder', 'M LC') && is('midfielder', 'WB/DM/M L') && !is('midfielder', 'AM/ST R'));
assert.ok(is('defender', 'D/M RLC') && is('defender', 'WB/M RC') && !is('defender', 'DM RL') && !is('defender', 'AM/ST R'));
assert.ok(is('keeper', 'GK') && !is('keeper', 'D C'));

assert.equal(positionLabel('AM/ST R'), 'Attacking midfielder, Striker (right)');
assert.equal(positionLabel('D/WB/M RC'), 'Defender, Wing-back, Midfielder (right, centre)');
assert.equal(positionLabel('GK'), 'Goalkeeper');

// Filters: only valid values get through.
const f = readFilters({ position: 'striker', max_age: '21', min_pace: '15', min_finishing: '99', nationality: ' Korea ', club: '', sort: 'pace' });
assert.deepEqual(f, { position: 'striker', maxAge: 21, minPace: 15, minFinishing: null, minTackling: null, minHeading: null, nationality: 'Korea', club: '', sort: 'pace' });
assert.equal(readFilters({ position: 'drop table', sort: 'x' }).position, '');
assert.equal(readFilters({ sort: 'x' }).sort, 'pace');
assert.equal(hasFilters(readFilters({})), false);
assert.equal(hasFilters(readFilters({ nationality: 'Japan' })), true);

// His cards from a SportsCardsPro search: only his, with the offer fields filled in.
const c = cardFromProduct({ id: 7, 'product-name': 'Lamine Yamal [Gold] #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club', 'loose-price': 4000 });
assert.deepEqual(c, { id: '7', player: 'Lamine Yamal', year: '2023', set_name: 'Topps Chrome UEFA Club', card_number: '64', variant: 'Gold', title: '2023 Topps Chrome UEFA Club #64 · Gold', loose_usd: 40, sales_per_year: null });
const list = cardsForPlayer([
  { id: 1, 'product-name': 'Lamine Yamal #64', 'console-name': 'Soccer Cards 2023 Topps Chrome UEFA Club' },
  { id: 2, 'product-name': 'Lamine Yamal #12', 'console-name': 'Soccer Cards 2025 Topps Chrome UEFA Club' },
  { id: 3, 'product-name': 'Lamine Yamal Jr #5', 'console-name': 'Soccer Cards 2024 Panini Prizm' },
], 'Lamine Yamal');
assert.deepEqual(list.map((x) => x.id), ['2', '1'], 'only his cards, newest first');
assert.equal(list[1].variant, 'Base');

// Best cards first: hot only with real sales a year, rookie year is his first season.
{
  const r = rankCards([
    { id: 'a', year: '2025', sales_per_year: 5 },
    { id: 'b', year: '2023', sales_per_year: 450 },
    { id: 'c', year: '2024', sales_per_year: 300 },
    { id: 'd', year: '2023', sales_per_year: 12 },
    { id: 'e', year: '2024', sales_per_year: 40 },
    { id: 'f', year: '2025', sales_per_year: null },
  ]);
  assert.deepEqual(r.map((x) => x.id), ['b', 'c', 'd', 'e', 'a', 'f'], 'hot rookie-year first, then hot, then rookie year, then the rest');
  assert.deepEqual(r.filter((x) => x.hot).map((x) => x.id), ['b', 'c'], 'only his top sellers with 20+ a year are hot');
  assert.deepEqual(r.filter((x) => x.rookie_year).map((x) => x.id), ['b', 'd']);
  assert.ok(rankCards([{ id: 'x', year: '2024', sales_per_year: null }]).every((x) => !x.hot), 'no sales numbers, no fire');
  assert.ok(rankCards([{ id: 'y', year: '2024', sales_per_year: 8 }]).every((x) => !x.hot), 'too few sales, no fire');
}

// Defenders use tackling and heading; goalkeepers have no ratings in the data.
{
  const d = readFilters({ position: 'defender', min_tackling: '14', min_heading: '13', sort: 'tackling', nationality: 'Korea' });
  assert.equal(d.minTackling, 14);
  assert.equal(d.minHeading, 13);
  assert.equal(d.sort, 'tackling');
  const k = readFilters({ position: 'keeper', min_tackling: '14', min_pace: '15', sort: 'pace' });
  assert.equal(k.minTackling, null);
  assert.equal(k.minPace, null);
  assert.equal(k.sort, 'age_snapshot');
  assert.equal(hasFilters(readFilters({ min_heading: '15' })), true);
}
{
  const { similarQuery } = await import('../lib/find-players.mjs');
  assert.equal(similarQuery({ position: 'D C', age_snapshot: 20, pace: 12, tackling: 15, heading: 14 }), 'position=defender&max_age=21&min_tackling=13&min_heading=12&sort=tackling');
  assert.equal(similarQuery({ position: 'D C', age_snapshot: 20, pace: 12 }), 'position=defender&max_age=21&sort=age_snapshot', 'before the defending ratings are loaded');
  assert.equal(similarQuery({ position: 'GK', age_snapshot: 19 }), 'position=keeper&max_age=20&sort=age_snapshot');
}

console.log('Find players checks passed (no database or network used).');
