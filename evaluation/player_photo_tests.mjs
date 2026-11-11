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
assert.ok(sameNation('Ivory Coast', "Côte d'Ivoire"));
assert.ok(sameNation('Senegal,Spain', 'Spain'));
assert.ok(!sameNation('Guinea', 'Equatorial Guinea'), 'whole names only');
assert.ok(!sameNation('Northern Ireland', 'Republic of Ireland'));
assert.ok(sameNation('Türkiye,Netherlands', 'Türkiye'));
assert.ok(!sameNation('France', 'Cameroon'));

// Search terms: 4 letters or more, surname first, at most two
assert.deepEqual(searchTerms('Juma Bah'), ['juma']);
assert.deepEqual(searchTerms("Tomás O'Connor"), ['connor', 'tomas']);
assert.deepEqual(searchTerms('Kim Ji-soo'), ['jisoo']);
assert.deepEqual(searchTerms('Myles Lewis-Skelly'), ['lewisskelly', 'lewis', 'skelly', 'myles']);
assert.deepEqual(searchTerms('Lee Young-Jun'), ['youngjun', 'young']);
assert.deepEqual(searchTerms('Başar Önal'), ['onal', 'basar']);
assert.deepEqual(searchTerms('Yusi'), ['yusi']);

// Picking a profile: exactly one must fit name, nationality and age
const photo = (id) => `https://media.api-sports.io/football/players/${id}.png`;
const okon = { name: 'Ime Okon', nationality: 'South Africa', age_snapshot: 21 };
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'South Africa', photo: photo(1) }]).status, 'found');
// Two pass, but only one is a full-name match with a nationality: that one wins.
assert.equal(pickProfile(okon, [{ id: 1, name: 'I. Okon', age: 21, nationality: 'South Africa', photo: photo(1) }, { id: 2, name: 'Ime Okon', age: 22, nationality: 'South Africa', photo: photo(2) }]).profile.id, 2);
// Two full-name matches: unsure.
assert.equal(pickProfile(okon, [{ id: 1, name: 'Ime Okon', age: 21, nationality: 'South Africa', photo: photo(1) }, { id: 2, name: 'Ime Okon', age: 22, nationality: 'South Africa', photo: photo(2) }]).status, 'unsure');
// From the real check (12 Nov 2026): ages 2 years apart on a full-name match are accepted.
assert.equal(pickProfile({ name: 'Rio Ngumoha', nationality: 'England,Nigeria', age_snapshot: 16 }, [{ id: 7, name: 'R. Ngumoha', firstname: 'Rio', lastname: 'Ngumoha', age: 18, nationality: 'England', photo: photo(7) }]).status, 'found');
assert.equal(pickProfile({ name: 'Yan Diomandé', nationality: 'Ivory Coast', age_snapshot: 18 }, [{ id: 8, name: 'Y. Diomande', firstname: 'Yan', lastname: 'Diomande', age: 19, nationality: "Côte d'Ivoire", photo: photo(8) }]).status, 'found');
const diao = [
  { id: 1, name: 'A. Diao', firstname: 'Abdoulaye', lastname: 'Diao', nationality: 'France', photo: photo(1) },
  { id: 2, name: 'Assane Diao', firstname: 'Assane Diao', lastname: 'Diaoune', age: 21, nationality: 'Spain', photo: photo(2) },
  { id: 3, name: 'A. Diao', firstname: 'Aliou', lastname: 'Diao', age: 23, nationality: 'Senegal', photo: photo(3) },
  { id: 4, name: 'A. Diao', age: 20, photo: photo(4) },
];
assert.equal(pickProfile({ name: 'Assane Diao', nationality: 'Senegal,Spain', age_snapshot: 19 }, diao).profile.id, 2);
// Initials only, with no nationality given, is never enough ("L. Myles" for Myles Lewis-Skelly).
assert.equal(pickProfile({ name: 'Myles Lewis-Skelly', nationality: 'England,Barbados', age_snapshot: 18 }, [{ id: 9, name: 'L. Myles', age: 17, photo: photo(9) }]).status, 'none');
// Three years apart is still too far, even with the full name.
assert.equal(pickProfile(okon, [{ id: 1, name: 'Ime Okon', age: 24, nationality: 'South Africa', photo: photo(1) }]).status, 'none');
// A full-name match with no nationality must be within a year.
assert.equal(pickProfile(okon, [{ id: 1, name: 'Ime Okon', age: 23, photo: photo(1) }]).status, 'none');
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
assert.ok(needsLookup({ status: 'none', checked_at: '2026-12-30' }, now, true), 'recheck now');
assert.ok(!needsLookup({ status: 'found', checked_at: '2026-12-30' }, now, true), 'a found photo is kept');

console.log('Player photo checks passed (no network or database used).');
