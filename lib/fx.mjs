// Today's exchange rates for converting overseas sales, so the owner does not type them in.
// Source: Frankfurter (frankfurter.dev), free, no key, daily rates from the European Central Bank
// and other official sources. Cached for a day. If it cannot be reached, overseas sales are only
// counted where the owner entered a rate himself in Owner settings.

export const FX_CURRENCIES = ['USD', 'GBP', 'EUR'];
const V2 = process.env.FX_API_BASE || 'https://api.frankfurter.dev/v2';
const V1 = process.env.FX_API_FALLBACK || 'https://api.frankfurter.app';

// Pulls "how many of each currency per 1 AUD" out of the response, whatever its exact shape.
export function readPerAud(data) {
  const out = {};
  const put = (cur, rate) => {
    const c = String(cur ?? '').toUpperCase();
    const r = Number(rate);
    if (FX_CURRENCIES.includes(c) && r > 0) out[c] = r;
  };
  const list = Array.isArray(data) ? data : Array.isArray(data?.rates) ? data.rates : Array.isArray(data?.data) ? data.data : null;
  if (list) for (const x of list) put(x?.quote ?? x?.currency ?? x?.to, x?.rate ?? x?.value);
  else if (data?.rates && typeof data.rates === 'object') for (const [c, r] of Object.entries(data.rates)) put(c, r);
  else if (data && typeof data === 'object') for (const [c, r] of Object.entries(data)) put(c, r);
  return out;
}

// Turns "per 1 AUD" into "A$ per 1 unit", rounded to 4 decimals.
export function toAudPer(perAud) {
  return Object.fromEntries(Object.entries(perAud).map(([c, r]) => [c, Math.round((1 / r) * 10000) / 10000]));
}

async function tryFetch(url) {
  const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Returns { rates: { USD: A$ per 1 USD, ... }, date, source } or { rates: {}, error }.
export async function getAudRates() {
  const quotes = FX_CURRENCIES.join(',');
  for (const url of [`${V2}/rates?base=AUD&quotes=${quotes}`, `${V1}/latest?from=AUD&to=${quotes}`]) {
    try {
      const data = await tryFetch(url);
      const perAud = readPerAud(data);
      if (Object.keys(perAud).length) {
        const date = data?.date ?? (Array.isArray(data) ? data[0]?.date : data?.rates?.[0]?.date) ?? null;
        return { rates: toAudPer(perAud), date, source: 'Frankfurter (European Central Bank and other official sources)' };
      }
    } catch (e) {
      console.error('Exchange rates not available from', url, e?.message ?? e);
    }
  }
  return { rates: {}, date: null, source: null, error: 'Today\'s exchange rates could not be loaded.' };
}

// The rate used for each currency: the owner's own rate if entered, otherwise today's rate.
export function effectiveRates(settings, live) {
  const own = { USD: settings?.fx_usd_aud, GBP: settings?.fx_gbp_aud, EUR: settings?.fx_eur_aud };
  return Object.fromEntries(FX_CURRENCIES.map((c) => [c, Number(own[c]) > 0 ? Number(own[c]) : live?.rates?.[c] ?? null]));
}
