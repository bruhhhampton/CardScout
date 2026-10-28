// Plain-code checks on what the AI agent reports. The AI never counts sales or
// calculates prices: the server does it here, from sales that pass these checks.

export function normaliseUrl(u) {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
    x.hash = '';
    return (x.host.toLowerCase().replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase();
  } catch {
    return null;
  }
}

export function urlsInText(text) {
  return (String(text ?? '').match(/https?:\/\/[^\s)<>"']+/g) ?? [])
    .map((u) => normaliseUrl(u.replace(/[.,;:!?]+$/, '')))
    .filter(Boolean);
}

const MONEY = /^\d+(\.\d{1,2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// sale: { price, currency, sold_date, url, title, exact_match, is_lot, note }
// known: Set of normalised URLs the agent actually saw (search results + staff notes)
export function checkSale(sale, known, today, windowDays) {
  const problems = [];
  const n = normaliseUrl(sale?.url);
  if (!n) problems.push('No valid link');
  else if (!known.has(n)) problems.push('Link was not in the search results or staff notes');
  const price = String(sale?.price ?? '').trim();
  if (!MONEY.test(price) || Number(price) <= 0 || Number(price) > 1000000) problems.push('Price is not a valid amount');
  if (String(sale?.currency ?? '').toUpperCase() !== 'AUD') problems.push('Not in AUD (convert by hand if needed)');
  const d = String(sale?.sold_date ?? '');
  const t = DATE.test(d) ? Date.parse(d + 'T00:00:00Z') : NaN;
  const now = Date.parse(today + 'T00:00:00Z');
  if (!Number.isFinite(t)) problems.push('Sold date missing or not YYYY-MM-DD');
  else if (t > now) problems.push('Sold date is in the future');
  else if (now - t > windowDays * 86400000) problems.push(`Older than ${windowDays} days`);
  if (sale?.exact_match !== true) problems.push('Not confirmed as the exact same card');
  if (sale?.is_lot === true) problems.push('Lot or bundle, not a single card');
  return { accepted: problems.length === 0, problems, price: Number(price), key: n };
}

export function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  return Math.round(m * 100) / 100;
}

// Accepted sales, one per link, and the server-calculated count and median.
export function summariseSales(checked) {
  const seen = new Set();
  const ok = checked.filter((c) => c.accepted && !seen.has(c.key) && seen.add(c.key));
  return { sales_count: ok.length, median_sold_aud: median(ok.map((c) => c.price)) };
}

export const SCORE_KEYS = ['football', 'career', 'collector', 'card', 'valuation'];
export const CHECK_KEYS = ['rookie_card', 'first_team'];

// draft: { scores: { football: { score, reason, sources: [url] }, ... }, questions_for_staff: [text] }
export function checkDraft(draft, known) {
  const out = { scores: {}, questions_for_staff: [] };
  for (const k of SCORE_KEYS) {
    const s = draft?.scores?.[k] ?? {};
    const score = Number.isInteger(s.score) && s.score >= 0 && s.score <= 100 ? s.score : null;
    const sources = (Array.isArray(s.sources) ? s.sources : []).filter((u) => known.has(normaliseUrl(u))).slice(0, 5);
    out.scores[k] = {
      score,
      reason: String(s.reason ?? '').slice(0, 600),
      sources,
      flag: score == null ? 'No valid score; staff must enter one' : sources.length ? null : 'No checkable source; staff must verify',
    };
  }
  // Cerf's two checks. A suggestion only: staff confirm it. Without a checkable source,
  // a "yes" or "no" is turned into "unsure", so an unsupported answer never decides anything.
  out.checks = {};
  for (const k of CHECK_KEYS) {
    const c = draft?.checks?.[k] ?? {};
    const sources = (Array.isArray(c.sources) ? c.sources : []).filter((u) => known.has(normaliseUrl(u))).slice(0, 5);
    let answer = ['yes', 'no', 'unsure'].includes(c.answer) ? c.answer : 'unsure';
    let flag = null;
    if (answer !== 'unsure' && !sources.length) {
      answer = 'unsure';
      flag = 'No checkable source, so marked Not sure; staff must check';
    }
    out.checks[k] = { answer, reason: String(c.reason ?? '').slice(0, 400), sources, flag };
  }
  out.questions_for_staff = (Array.isArray(draft?.questions_for_staff) ? draft.questions_for_staff : [])
    .map((q) => String(q).slice(0, 300)).filter(Boolean).slice(0, 6);
  return out;
}
