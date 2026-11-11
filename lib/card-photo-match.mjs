// Card pictures from the shop's own scans. When a card in the price guide is the same card the
// shop has scanned before (same player, year, set, number and version), the saved scan photo is shown.
// Plain rules, no network or database (tested in evaluation/card_photo_tests.mjs).
import { nameFit, words } from './player-photo-match.mjs';

const number = (n) => String(n ?? '').replace(/^#/, '').replace(/\s+/g, '').toLowerCase();
const version = (v) => words(v || 'Base').join(' ');
// Set names differ in length between sources ("Topps Chrome UEFA" and "Topps Chrome UEFA Club
// Competitions"), so one may be the start of the other, but the words must agree in order.
function sameSet(a, b) {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && short.every((w, i) => long[i] === w);
}
export function sameCardAs(scan, card) {
  return Boolean(scan && card)
    && nameFit(scan.player, card.player) === 'full'
    && String(scan.year) === String(card.year)
    && number(scan.card_number) !== '' && number(scan.card_number) === number(card.card_number)
    && version(scan.variant) === version(card.variant)
    && sameSet(scan.set_name, card.set_name);
}
// The newest scan of this card, or null. scans: offers with a photo, newest first.
export const scanFor = (card, scans) => (scans ?? []).find((s) => sameCardAs(s, card)) ?? null;
