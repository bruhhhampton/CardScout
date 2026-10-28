// Owner settings: one definition used by the form, the server checks and the display.
// kind: money (AUD, 2 decimals), int, percent (stored 0-1, entered 0-100), score (0-100), text,
//       yesno (stored true/false), rate (A$ per 1 unit of another currency, up to 4 decimals, optional)
export const SETTINGS_SECTIONS = [
  {
    title: 'Shop',
    fields: [
      { name: 'shop_name', label: 'Shop name', kind: 'text', max: 80 },
      { name: 'provisional', label: 'Are these values still provisional?', kind: 'yesno', hint: 'Choose No once Cerf has confirmed them' },
    ],
  },
  {
    title: 'Spending and stock',
    fields: [
      { name: 'staff_limit_aud', label: 'Staff can approve up to (AUD)', kind: 'money', min: 0, maxValue: 1000000, hint: 'Above this, the owner decides' },
      { name: 'max_copies', label: 'Most copies of one card to hold', kind: 'int', min: 1, maxValue: 1000 },
      { name: 'excluded_sets', label: 'Sets you never buy', kind: 'text', max: 500, optional: true, hint: 'Separate with commas, for example Topps Chrome, Panini Prizm' },
    ],
  },
  {
    title: 'Pricing',
    fields: [
      { name: 'offer_fraction', label: 'Offer up to this share of market value (%)', kind: 'percent', min: 1, maxValue: 100 },
      { name: 'min_margin', label: 'Minimum margin (%)', kind: 'percent', min: 0, maxValue: 99 },
      { name: 'selling_costs_aud', label: 'Selling costs per card (AUD)', kind: 'money', min: 0, maxValue: 1000000, hint: 'Fees, postage and so on' },
    ],
  },
  {
    title: 'Evidence needed',
    fields: [
      { name: 'min_sales', label: 'At least this many matching sold sales', kind: 'int', min: 1, maxValue: 50 },
      { name: 'sales_window_days', label: 'Within the last (days)', kind: 'int', min: 1, maxValue: 365 },
    ],
  },
  {
    title: 'Overseas sales',
    fields: [
      { name: 'count_overseas', label: 'Count overseas sales as evidence?', kind: 'yesno', hint: 'For example US eBay sales. They are converted to AUD and labelled overseas.' },
      { name: 'overseas_adjust', label: 'Count overseas sales at this share of their converted price (%)', kind: 'percent', min: 1, maxValue: 100, hint: 'For example 85 to allow for shipping and GST. Your call.' },
      { name: 'fx_usd_aud', label: 'Your own rate: A$ per 1 US dollar (optional)', kind: 'rate', hint: "Leave blank to use today's rate" },
      { name: 'fx_gbp_aud', label: 'Your own rate: A$ per 1 British pound (optional)', kind: 'rate', hint: "Leave blank to use today's rate" },
      { name: 'fx_eur_aud', label: 'Your own rate: A$ per 1 euro (optional)', kind: 'rate', hint: "Leave blank to use today's rate" },
    ],
  },
  {
    title: 'How I judge players (weights, must add up to 100)',
    fields: [
      { name: 'w_football', label: 'Football quality', kind: 'score' },
      { name: 'w_career', label: 'Career path', kind: 'score' },
      { name: 'w_collector', label: 'Collector appeal', kind: 'score' },
      { name: 'w_card', label: 'Card quality', kind: 'score' },
      { name: 'w_valuation', label: 'Valuation', kind: 'score' },
    ],
  },
  {
    title: 'My thresholds (scores out of 100)',
    fields: [
      { name: 'reject_football_below', label: 'Reject if football quality is below', kind: 'score' },
      { name: 'speculative_football_below', label: 'Needs review if football quality is below', kind: 'score' },
      { name: 'speculative_career_below', label: 'Needs review if career path is below', kind: 'score' },
      { name: 'expensive_valuation_below', label: 'Too expensive if valuation is below', kind: 'score' },
      { name: 'attractive_total_min', label: 'Attractive if total is at least', kind: 'score' },
      { name: 'attractive_valuation_min', label: 'and valuation is at least', kind: 'score' },
    ],
  },
];

export const SETTINGS_FIELDS = SETTINGS_SECTIONS.flatMap((s) => s.fields);
const WEIGHTS = ['w_football', 'w_career', 'w_collector', 'w_card', 'w_valuation'];

// Turns a stored settings row into the text shown in form boxes.
export function toFormValues(row) {
  const v = {};
  for (const f of SETTINGS_FIELDS) {
    const x = row?.[f.name];
    if (f.kind === 'yesno') v[f.name] = x ? 'yes' : 'no';
    else if (x == null) v[f.name] = '';
    else if (f.kind === 'percent') v[f.name] = String(Math.round(Number(x) * 1000) / 10);
    else v[f.name] = String(x);
  }
  return v;
}

const MONEY = /^\d+(\.\d{1,2})?$/;
const INT = /^\d+$/;
const PCT = /^\d+(\.\d)?$/;
const RATE = /^\d+(\.\d{1,4})?$/;

export function validateSettings(values) {
  const errors = {};
  const row = {};
  for (const f of SETTINGS_FIELDS) {
    const t = String(values[f.name] ?? '').trim();
    if (f.kind === 'yesno') {
      if (t !== 'yes' && t !== 'no') errors[f.name] = 'Choose Yes or No.';
      else row[f.name] = t === 'yes';
      continue;
    }
    if (f.kind === 'rate') {
      if (!t) { row[f.name] = null; continue; }
      if (!RATE.test(t) || Number(t) <= 0 || Number(t) > 100) errors[f.name] = 'Enter a rate such as 1.5432, or leave blank.';
      else row[f.name] = Number(t);
      continue;
    }
    if (f.kind === 'text') {
      if (!t && !f.optional) errors[f.name] = `${f.label} is required.`;
      else if (t.length > f.max) errors[f.name] = `Use ${f.max} characters or fewer.`;
      else row[f.name] = t;
      continue;
    }
    if (!t) { errors[f.name] = 'Required.'; continue; }
    const lo = f.kind === 'score' ? 0 : f.min;
    const hi = f.kind === 'score' ? 100 : f.maxValue;
    const ok = f.kind === 'money' ? MONEY.test(t) : f.kind === 'percent' ? PCT.test(t) : INT.test(t);
    if (!ok) {
      errors[f.name] =
        f.kind === 'money' ? 'Enter dollars, up to 2 decimals, for example 150 or 150.50.'
        : f.kind === 'percent' ? 'Enter a percentage, for example 80 or 25.5.'
        : 'Enter a whole number.';
      continue;
    }
    const n = Number(t);
    if (n < lo || n > hi) { errors[f.name] = `Must be between ${lo} and ${hi}.`; continue; }
    row[f.name] = f.kind === 'percent' ? Math.round(n * 10) / 1000 : f.kind === 'money' ? t : n;
  }
  if (WEIGHTS.every((w) => row[w] != null)) {
    const sum = WEIGHTS.reduce((a, w) => a + row[w], 0);
    if (sum !== 100) errors.w_valuation = `The five weights add up to ${sum}. They must add up to 100.`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, row };
}
