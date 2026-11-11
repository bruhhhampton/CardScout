// Player photo matching (lib/player-photo-match.mjs). No network or database used.
// Run: node evaluation/player_photo_tests.mjs
import assert from 'node:assert/strict';
import { cleanName, isApiPhotoUrl, needsLookup, pickProfile, sameName, sameNation, searchTerms } from '../lib/player-photo-match.mjs';

// Names: word order, hyphens, accents, initials
assert.ok(sameName('Kim Ji-soo', 'Kim Ji-Soo'));
assert.ok(sameName('Kim Ji-soo', 'Ji-Soo Kim'));
assert.ok(sameName('Kim Ji-soo', 'J. Kim'));
assert.ok(sameName('Kevin André Dæhlin', 'K. A. Dæhlin'));
assert.ok(sameName('Kevin André Dæhlin', 'Kevin Dæhlin'));
assert.ok(sameName('Vinícius Júnior', 'Vinicius Junior'));
assert.ok(sameName('Nicolás Rodríguez(Orlando City SC,Colombia)', 'N. Rodríguez'));
assert.ok(!sameName('Kim Ji-soo', 'K. Kim'));
assert.ok(!sameName('Kim Ji-soo', 'Kim'));
assert.ok(!sameName('Bright Ocran', 'Ocran'));
assert.ok(!sameName('Kevin André Dæhlin', 'A. K. Dæhlin'));
assert.equal(cleanName('Nicolás Rodríguez(Orlando City SC,Colombia)'), 'Nicolás Rodríguez');

// Nationalities: several of ours, different spellings
assert.ok(sameNation('England,Nigeria,Spain', 'England'));
assert.ok(sameNation('Korea Republic', 'South Korea'));
assert.ok(sameNation('Türkiye,Netherlands', 'Türkiye'));
assert.ok(!sameNation('France', 'Cameroon'));

// Search terms: 4 letters or more, surname first, at most two
assert.deepEqual(searchTerms('Juma Bah'), ['juma']);
assert.deepEqual(searchTerms("Tomás O'Connor"), ['connor', 'tomas']);
assert.deepEqual(searchTerms('Kim Ji-soo'), ['jisoo']);
assert.deepEqual(searchTerms('Başar Önal'), ['onal', 'basar']);
assert.deepEqual(searchTerms('Yusi'), ['yusi']);

// Picking a profile: exactly one must fit name, nationality and age
const photo = (id) => `https://media.api-sports.io/football/players/${id}.png`;
const okon = { name: 'Ime Okon', nationality: 'South Africa', age_snapshot: 21 };
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'South Africa', photo: photo(1) }]).status, 'found');
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'South Africa', photo: photo(1) }, { id: 2, name: 'Ime Okon', age: 22, nationality: 'South Africa', photo: photo(2) }]).status, 'unsure');
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 30, nationality: 'South Africa', photo: photo(1) }]).status, 'none', 'age too far off');
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'Nigeria', photo: photo(1) }]).status, 'none', 'other nationality');
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'South Africa', photo: 'https://example.com/1.png' }]).status, 'none', 'photo from elsewhere');
assert.equal(pickProfile(okon, []).status, 'none');

// Photos only from API-Football's image server
assert.ok(isApiPhotoUrl('https://media.api-sports.io/football/players/276.png'));
assert.ok(!isApiPhotoUrl('http://media.api-sports.io/football/players/276.png'));
assert.ok(!isApiPhotoUrl('https://media.api-sports.io.evil.com/football/players/276.png'));
assert.ok(!isApiPhotoUrl('https://media.api-sports.io/football/teams/33.png'));
assert.ok(!isApiPhotoUrl('not a url'));

// Looking up again: never for a found photo or the blank picture, after 30 days for no match
const now = Date.parse('2026-12-31T00:00:00Z');
assert.ok(needsLookup(null, now));
assert.ok(!needsLookup({ status: 'found', checked_at: '2026-01-01' }, now));
assert.ok(!needsLookup({ status: 'placeholder', checked_at: '2026-01-01' }, now));
assert.ok(!needsLookup({ status: 'none', checked_at: '2026-12-20' }, now));
assert.ok(needsLookup({ status: 'unsure', checked_at: '2026-11-01' }, now));

console.log('Player photo checks passed (no network or database used).');
