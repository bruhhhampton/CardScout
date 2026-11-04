import 'server-only';
import { buildQuery, pickProduct, summariseProduct, variantsFor } from './price-guide.mjs';

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
      return { found: false, reason: 'No exact match on SportsCardsPro for this player, number, year and variant.', candidates: pick.candidates };
    }
    const product = await call('/api/product', { id: pick.product.id });
    const summary = summariseProduct(product, offer, { rate, adjust });
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
