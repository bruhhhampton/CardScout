import 'server-only';
import { buildQuery, cardsForPlayer, pickProduct, rankCards, summariseProduct, variantsFor } from './price-guide.mjs';

// SportsCardsPro Prices API. On only when SPORTSCARDSPRO_TOKEN is set on the server, so it can
// stay off on the live site until the licence question is answered.
// Limits: 1 call per second. Their data is licensed, so it is never shown on a public page.
const BASE = process.env.PRICE_API_BASE || 'https://www.sportscardspro.com';
let lastCall = 0;

export function priceGuideEnabled() {
  return Boolean(process.env.SPORTSCARDSPRO_TOKEN);
}

async function call(path, params) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${BASE}${path}?${new URLSearchParams({ t: process.env.SPORTSCARDSPRO_TOKEN, ...params })}`;
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  const body = await res.json().catch(() => ({ status: 'error', 'error-message': `Not JSON (HTTP ${res.status})` }));
  if (body.status !== 'success') throw new Error(body['error-message'] || `HTTP ${res.status}`);
  return body;
}

// Finds the exact card and its value for the grade staff entered. Never throws.
// Returns the summary from price-guide.mjs, or { found: false, reason, candidates? }.
export async function lookupPriceGuide(offer, { rate = null, adjust = 1 } = {}) {
  if (!priceGuideEnabled()) return { found: false, reason: 'Price guide not switched on.' };
  try {
    const search = await call('/api/products', { q: buildQuery(offer) });
    const pick = pickProduct(search.products, offer);
    if (!pick.product) {
      // Every version SportsCardsPro lists for this player, number and year, so staff can tap theirs.
      // CardScout never picks one itself: similar versions can have very different prices.
      const options = variantsFor(search.products, offer).filter((v) => v.id);
      return {
        found: false,
        options,
        candidates: pick.candidates,
        reason: options.length
          ? 'SportsCardsPro does not list this exact version. Pick the one on the card from the list.'
          : 'No exact match on SportsCardsPro for this player, number, year and variant.',
      };
    }
    const product = await call('/api/product', { id: pick.product.id });
    // The other versions of this card, from the same search (no extra call).
    const versions = variantsFor(search.products, offer).map((v) => v.variant);
    const summary = { ...summariseProduct(product, offer, { rate, adjust }), versions };
    if (!summary.grade) return { ...summary, found: false, reason: `SportsCardsPro has no price for the grade "${offer.grade_condition}".` };
    if (summary.value_usd == null) return { ...summary, found: false, reason: `SportsCardsPro has no ${summary.grade} price for this card.` };
    if (summary.value_aud == null) return { ...summary, note: "Today's exchange rate could not be loaded, so this value is only shown in US dollars and is not used for the verdict." };
    return summary;
  } catch (e) {
    console.error('Price guide lookup failed:', e?.message);
    return { found: false, reason: 'The price guide could not be reached. Try again later.' };
  }
}

// The versions of this card SportsCardsPro lists (Base, Silver, Gold /50 ...). Never throws.
// Returns { variants: [{ variant, name, set }] } or { variants: [], reason }.
export async function listVariants(card) {
  if (!priceGuideEnabled()) return { variants: [], reason: 'Price guide not switched on.' };
  if (!card?.player || !card?.card_number) return { variants: [], reason: 'Needs the player and card number first.' };
  try {
    const search = await call('/api/products', { q: buildQuery({ ...card, variant: '' }) });
    return { variants: variantsFor(search.products, card) };
  } catch (e) {
    console.error('Variant lookup failed:', e?.message);
    return { variants: [], reason: 'SportsCardsPro could not be reached.' };
  }
}

// Price for the version staff picked from the list. Never throws.
export async function priceForPick(productId, offer, { rate = null, adjust = 1 } = {}) {
  if (!priceGuideEnabled()) return { found: false, reason: 'Price guide not switched on.' };
  if (!/^\d{1,12}$/.test(String(productId ?? ''))) return { found: false, reason: 'That card could not be found on SportsCardsPro.' };
  try {
    const product = await call('/api/product', { id: String(productId) });
    const summary = { ...summariseProduct(product, offer, { rate, adjust }), picked_by_staff: true };
    if (!summary.grade) return { ...summary, found: false, reason: `SportsCardsPro has no price for the grade "${offer.grade_condition}".` };
    if (summary.value_usd == null) return { ...summary, found: false, reason: `SportsCardsPro has no ${summary.grade} price for this card.` };
    if (summary.value_aud == null) return { ...summary, note: "Today's exchange rate could not be loaded, so this value is only shown in US dollars and is not used for the verdict." };
    return summary;
  } catch (e) {
    console.error('Price guide pick failed:', e?.message);
    return { found: false, reason: 'The price guide could not be reached. Try again later.' };
  }
}

// A player's cards on SportsCardsPro, for his profile. One search call. Never throws.
export async function playerCards(name) {
  if (!priceGuideEnabled()) return { cards: [], reason: 'The price guide is not switched on.' };
  if (String(name ?? '').trim().length < 3) return { cards: [], reason: null };
  try {
    const search = await call('/api/products', { q: String(name).trim() });
    let cards = cardsForPlayer(search.products, name);
    // If the search did not include sales a year, look up his three most likely best cards
    // (earliest year, highest value) one at a time, within SportsCardsPro's 1 call a second.
    if (cards.length && cards.every((c) => c.sales_per_year == null)) {
      const first = Math.min(...cards.map((c) => Number(c.year) || 9999));
      const check = [...cards].sort((a, b) => (Number(a.year) === first ? -1 : 0) - (Number(b.year) === first ? -1 : 0) || (b.loose_usd ?? 0) - (a.loose_usd ?? 0)).slice(0, 3);
      for (const c of check) {
        const d = await call('/api/product', { id: c.id });
        c.sales_per_year = d['sales-volume'] == null || d['sales-volume'] === '' ? null : Number(d['sales-volume']);
        if (c.loose_usd == null && Number(d['loose-price']) > 0) c.loose_usd = Number(d['loose-price']) / 100;
      }
    }
    return { cards: rankCards(cards), reason: null };
  } catch (e) {
    console.error('Player cards lookup failed:', e?.message);
    return { cards: [], reason: 'SportsCardsPro could not be reached.' };
  }
}
