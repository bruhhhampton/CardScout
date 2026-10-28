// Run: node evaluation/fm_fit_tests.mjs
// Checks the JavaScript port of Cerf's FM role-fit score against values from his cerf.py.
import assert from 'node:assert/strict';
import { fmFit, roles, combineFootball, FM_ATTRS } from '../lib/fm-fit.mjs';

// Same position rules as cerf.py.
for (const p of ['DM', 'MC', 'WB R', 'D/WB RL', 'GK']) assert.deepEqual(roles(p), []);
assert.ok(roles('AM/ST RL').includes('WINGER'));
assert.ok(roles('AM C').includes('AM'));

// Lamine Yamal's FM26 attributes (community data); cerf.py gives 84.8 as a winger.
const yamal = { position: 'M/AM R', dribbling: 18, first_touch: 18, technique: 18, passing: 17, finishing: 14, decisions: 16, vision: 18, flair: 19, anticipation: 13, off_the_ball: 15, composure: 15, acceleration: 16, pace: 15, agility: 18, balance: 14 };
const y = fmFit(yamal);
assert.equal(y.role, 'WINGER');
assert.equal(y.score, 84.8);

// All attributes 15 out of 20 = 75 for every role (cerf.py test_scales).
const flat = Object.fromEntries(FM_ATTRS.map((k) => [k, 15]));
assert.equal(fmFit({ ...flat, position: 'AM RL' }).score, 75);
// Unknown attributes are not zeros; under 80% coverage there is no score (cerf.py).
assert.equal(fmFit({ position: 'AM C' }), null);
assert.equal(fmFit({ ...Object.fromEntries(FM_ATTRS.map((k) => [k, 0])), position: 'ST' }), null);
// Defenders get no attacking fit, so football quality is real-world only.
assert.equal(fmFit({ ...flat, position: 'D C' }), null);
assert.equal(combineFootball(70, null), 70);
assert.equal(combineFootball(92, 84.8), 90.56);
console.log(`FM role-fit checks passed (Yamal ${y.score} as a winger).`);
