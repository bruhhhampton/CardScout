// What staff enter to assess an offer. Checked on the server.
export const SCORE_FIELDS = [
  { name: 'score_football', key: 'football', label: 'Football quality', formLabel: 'Real-world football quality', hint: 'Real matches, minutes, role and repeated performances.' },
  { name: 'score_career', key: 'career', label: 'Career path', hint: 'First-team chances, exposure, likely next move' },
  { name: 'score_collector', key: 'collector', label: 'Collector appeal', hint: 'Demand from buyers, style, following' },
  { name: 'score_card', key: 'card', label: 'Card quality', hint: 'Recognised set, rookie card, numbering, condition' },
  { name: 'score_valuation', key: 'valuation', label: 'Valuation', hint: 'Is the price fair against sold comparables?' },
];

// Cerf's two gates from his CERF model: a card must be a recognised rookie card,
// and the player must have a real first-team chance. Either answered "no" means decline.
export const GATE_FIELDS = [
  { name: 'rookie_card', label: 'Is this a recognised rookie card?', hint: "Cerf's rule: he only buys recognised rookie cards (RC)" },
  { name: 'first_team', label: 'Does the player have a first-team chance?', hint: "Cerf's rule: real minutes or a clear path to the first team" },
];
export const GATE_ANSWERS = ['yes', 'no', 'unsure'];

const INT = /^\d+$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

export function validateAssessment(values) {
  const errors = {};
  const out = { scores: {} };
  const int = (name, lo, hi, label) => {
    const t = String(values[name] ?? '').trim();
    if (!t) errors[name] = `${label} is required.`;
    else if (!INT.test(t)) errors[name] = 'Enter a whole number.';
    else if (Number(t) < lo || Number(t) > hi) errors[name] = `Must be between ${lo} and ${hi}.`;
    else return Number(t);
    return null;
  };
  out.stock_count = int('stock_count', 0, 1000, 'Copies in stock');
  out.sales_count = int('sales_count', 0, 1000, 'Number of matching sales');
  const cond = String(values.condition ?? '');
  if (!['acceptable', 'not_acceptable', 'defect', 'unsure'].includes(cond)) errors.condition = 'Choose a condition.';
  else out.condition = cond;
  for (const g of GATE_FIELDS) {
    const v = String(values[g.name] ?? '');
    if (!GATE_ANSWERS.includes(v)) errors[g.name] = 'Choose Yes, No or Not sure.';
    else out[g.name] = v;
  }
  const med = String(values.median_sold_aud ?? '').trim();
  if (!med) out.median_sold_aud = null;
  else if (!MONEY.test(med)) errors.median_sold_aud = 'Enter dollars, up to 2 decimals, or leave blank if there are no sales.';
  else if (Number(med) > 1000000) errors.median_sold_aud = 'Must be $1,000,000 or less.';
  else out.median_sold_aud = Number(med);
  const src = String(values.evidence_source ?? '').trim();
  if (src.length > 500) errors.evidence_source = 'Use 500 characters or fewer.';
  out.evidence_source = src;
  for (const f of SCORE_FIELDS) {
    const v = int(f.name, 0, 100, f.label);
    if (v != null) out.scores[f.key] = v;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: out };
}
