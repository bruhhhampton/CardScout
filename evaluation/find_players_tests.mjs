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
assert.deepEqual(f, { position: 'striker', maxAge: 21, mins: { pace: 15 }, nationality: 'Korea', club: '', sort: 'pace' });
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

// Each position has its own ratings (Luka's suggestion).
{
  const { shownRatings, sortsFor, similarQuery } = await import('../lib/find-players.mjs');
  assert.deepEqual(shownRatings('striker'), ['finishing', 'off_the_ball', 'pace']);
  assert.deepEqual(shownRatings('attacker'), ['pace', 'dribbling', 'crossing']);
  assert.deepEqual(shownRatings('midfielder'), ['passing', 'vision', 'work_rate']);
  assert.deepEqual(shownRatings('defender'), ['tackling', 'jumping', 'positioning']);
  assert.deepEqual(shownRatings('keeper'), []);
  assert.deepEqual(sortsFor('defender'), ['tackling', 'jumping', 'positioning', 'age_snapshot']);
  // A centre-back search: tackling, jumping reach and positioning, best tackling first by default.
  const d = readFilters({ position: 'defender', min_tackling: '14', min_jumping: '15', min_positioning: '13', nationality: 'Korea' });
  assert.deepEqual(d.mins, { tackling: 14, jumping: 15, positioning: 13 });
  assert.equal(d.sort, 'tackling');
  // Ratings that do not suit the position are ignored (finishing for a defender, anything for a keeper).
  assert.deepEqual(readFilters({ position: 'defender', min_finishing: '15', min_vision: '15' }).mins, {});
  const k = readFilters({ position: 'keeper', min_tackling: '14', min_pace: '15', sort: 'pace' });
  assert.deepEqual(k.mins, {});
  assert.equal(k.sort, 'age_snapshot');
  // Each position's default order.
  assert.equal(readFilters({ position: 'striker' }).sort, 'finishing');
  assert.equal(readFilters({ position: 'midfielder', sort: 'heading' }).sort, 'passing', 'a rating that does not suit the position cannot be the order');
  assert.equal(hasFilters(readFilters({ position: 'midfielder', min_passing: '15' })), true);
  // More like him uses the same three ratings.
  assert.equal(similarQuery({ position: 'D C', age_snapshot: 20, tackling: 15, jumping: 16, positioning: 14 }), 'position=defender&max_age=21&min_tackling=13&min_jumping=14&min_positioning=12&sort=tackling');
  assert.equal(similarQuery({ position: 'M C', age_snapshot: 19, passing: 15, vision: 14, work_rate: 16 }), 'position=midfielder&max_age=20&min_passing=13&min_vision=12&min_work_rate=14&sort=passing');
  assert.equal(similarQuery({ position: 'D C', age_snapshot: 20 }), 'position=defender&max_age=21&sort=age_snapshot', 'no ratings loaded');
  assert.equal(similarQuery({ position: 'GK', age_snapshot: 19 }), 'position=keeper&max_age=20&sort=age_snapshot');
}

// Name matching between Football Manager and SportsCardsPro.
{
  const { samePlayer, maybePlayer, maybeCardsForPlayer, cardsForPlayer: cards } = await import('../lib/price-guide.mjs');
  assert.ok(samePlayer('Min-hyeok Yang', 'Yang Min-hyeok'), 'name order');
  assert.ok(samePlayer('Yang Min-hyeok', 'Yang Minhyeok'), 'hyphen');
  assert.ok(samePlayer('Vinícius Júnior', 'Vinicius Jr'), 'accents and Jr');
  assert.ok(samePlayer('Kylian Mbappé', 'Kylian Mbappe'));
  assert.ok(samePlayer("N'Golo Kanté", 'NGolo Kante'), 'apostrophe');
  assert.ok(!samePlayer('Lamine Yamal', 'Lamine Yamal Jr'), 'an extra word is a different name');
  assert.ok(!samePlayer('Kim Ji-soo', 'Kim Min-jae'), 'shared family name is not enough');
  assert.ok(maybePlayer('Rodrygo Silva de Goes', 'Rodrygo'), 'short name inside full name');
  assert.ok(maybePlayer('Rodrygo Silva de Goes', 'Silva') && !samePlayer('Rodrygo Silva de Goes', 'Silva'), 'a common word alone goes to "may be his", never counted as his');
  const products = [
    { id: 1, 'product-name': 'Yang Min-hyeok #150', 'console-name': 'Soccer Cards 2024 Topps Chrome UEFA Club' },
    { id: 2, 'product-name': 'Rodrygo #20', 'console-name': 'Soccer Cards 2022 Topps Chrome UEFA Club' },
  ];
  assert.deepEqual(cards(products, 'Min-hyeok Yang').map((c) => c.id), ['1']);
  assert.deepEqual(cards(products, 'Rodrygo Silva de Goes').map((c) => c.id), [], 'a short name is never counted automatically');
  assert.deepEqual(maybeCardsForPlayer(products, 'Rodrygo Silva de Goes').map((c) => c.id), ['2']);
  // Price lookups for offers use the same rule.
  const { pickProduct } = await import('../lib/price-guide.mjs');
  assert.equal(pickProduct(products, { player: 'Min-hyeok Yang', card_number: '150', year: '2024', variant: 'Base' }).product?.id, 1);
  console.log('Name matching checks passed.');
}

console.log('Find players checks passed (no database or network used).');
