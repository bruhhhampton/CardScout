// Card pictures from the shop's own scans (lib/card-photo-match.mjs). No network or database used.
// Run: node evaluation/card_photo_tests.mjs
import assert from 'node:assert/strict';
import { sameCardAs, scanFor } from '../lib/card-photo-match.mjs';

const card = { player: 'Lamine Yamal', year: '2023', set_name: 'Topps Chrome UEFA Club', card_number: '64', variant: 'Base' };
const scan = { id: 'a', player: 'Lamine Yamal', year: 2023, set_name: 'Topps Chrome UEFA Club Competitions', card_number: '#64', variant: 'Base' };
assert.ok(sameCardAs(scan, card), 'longer set name, # on the number');
assert.ok(sameCardAs({ ...scan, player: 'Yamal Lamine' }, card), 'name the other way round');
assert.ok(sameCardAs({ ...scan, variant: '' }, card), 'blank version is Base');
assert.ok(!sameCardAs({ ...scan, variant: 'Gold Refractor /50' }, card), 'other version');
assert.ok(!sameCardAs({ ...scan, card_number: '65' }, card), 'other number');
assert.ok(!sameCardAs({ ...scan, year: 2024 }, card), 'other year');
assert.ok(!sameCardAs({ ...scan, set_name: 'Panini Prizm' }, card), 'other set');
assert.ok(!sameCardAs({ ...scan, set_name: 'Topps' }, card), 'one-word set is too vague');
assert.ok(!sameCardAs({ ...scan, player: 'L. Yamal' }, card), 'initials are not enough');
assert.ok(!sameCardAs({ ...scan, card_number: '' }, { ...card, card_number: '' }), 'no number, no match');
assert.equal(scanFor(card, [{ ...scan, id: 'new' }, { ...scan, id: 'old' }]).id, 'new', 'newest scan first');
assert.equal(scanFor(card, []), null);
console.log('Card photo checks passed (no network or database used).');
