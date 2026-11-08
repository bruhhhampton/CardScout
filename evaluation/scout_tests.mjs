// Run: node evaluation/scout_tests.mjs   (no AI, database or network used)
import assert from 'node:assert/strict';
import { checkPicks } from '../lib/scout-checks.mjs';
import { normaliseUrl } from '../lib/agent-checks.mjs';
import { similarQuery } from '../lib/find-players.mjs';

const yang = { player_id: 'p2', name: 'Yang Min-hyeok', age_snapshot: 18, club_snapshot: 'Tottenham Hotspur', position: 'AM R' };
const lee = { player_id: 'p3', name: 'Lee Seung-won', age_snapshot: 20, club_snapshot: 'Ulsan HD', position: 'AM/ST C' };
const players = new Map([[yang.player_id, yang], [lee.player_id, lee]]);
const cards = new Map([['21', { id: '21', title: '2024 Topps Chrome UEFA Club #150', player_key: 'yang min-hyeok' }], ['31', { id: '31', title: 'Lee card', player_key: 'lee seung-won' }]]);
const known = new Set(['https://news.test/yang', 'https://news.test/lee'].map(normaliseUrl));

const r = checkPicks({
  summary: 'Young quick attackers.',
  picks: [
    { player_id: 'p2', why: 'Starting for Spurs.', sources: ['https://news.test/yang', 'https://made-up.test/x'], card_id: '21' },
    { player_id: 'p9', why: 'A player the search never returned.', sources: ['https://news.test/lee'] },
    { player_id: 'p3', why: 'Scoring for Ulsan.', sources: ['https://made-up.test/y'], card_id: '21' },
    { player_id: 'p2', why: 'Duplicate.', sources: [] },
  ],
}, { players, cards, known });
assert.deepEqual(r.picks.map((p) => p.name), ['Yang Min-hyeok', 'Lee Seung-won'], 'unknown and duplicate players dropped');
assert.deepEqual(r.picks[0].sources, ['https://news.test/yang'], 'made-up source dropped');
assert.equal(r.picks[0].card.id, '21');
assert.equal(r.picks[1].checked, false, 'no real source means unchecked');
assert.equal(r.picks[1].card, null, "another player's card is not attached");
assert.equal(checkPicks({}, { players, cards, known }).picks.length, 0);

assert.equal(similarQuery({ position: 'AM R', age_snapshot: 18, pace: 17, finishing: 12 }), 'position=attacker&max_age=19&min_pace=15&min_finishing=10&sort=pace');
assert.equal(similarQuery({ position: 'D C', age_snapshot: 20, pace: 12, finishing: 5 }), 'position=defender&max_age=21&min_pace=10&sort=pace');
console.log('Scout checks passed (no AI, database or network used).');
