// Checks a submitted offer. Used by the server action, so these rules
// apply even if someone bypasses the browser form.
// Returns { ok: true, offer } or { ok: false, errors }.

export const FIELDS = [
  { name: 'player', label: 'Player', max: 120 },
  { name: 'year', label: 'Year' },
  { name: 'set_name', label: 'Set name', max: 120 },
  { name: 'card_number', label: 'Card number', max: 40 },
  { name: 'variant', label: 'Variant', max: 80 },
  { name: 'grade_condition', label: 'Grade or condition', max: 80 },
  { name: 'asking_price_aud', label: 'Asking price (AUD)' },
];

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const YEAR_PATTERN = /^\d{4}$/;

export function readValues(formData) {
  const values = {};
  for (const f of FIELDS) {
    const raw = formData.get(f.name);
    values[f.name] = typeof raw === 'string' ? raw : '';
  }
  return values;
}

export function validateOffer(values) {
  const errors = {};
  const offer = {};

  for (const f of FIELDS) {
    if (f.name === 'year' || f.name === 'asking_price_aud') continue;
    const text = values[f.name].trim();
    if (!text) errors[f.name] = `${f.label} is required.`;
    else if (text.length > f.max) errors[f.name] = `${f.label} must be ${f.max} characters or fewer.`;
    else offer[f.name] = text;
  }

  const year = values.year.trim();
  if (!year) errors.year = 'Year is required.';
  else if (!YEAR_PATTERN.test(year)) errors.year = 'Year must be a four-digit whole number, for example 2024.';
  else if (Number(year) < 1900 || Number(year) > 2100) errors.year = 'Year must be between 1900 and 2100.';
  else offer.year = Number(year);

  const price = values.asking_price_aud.trim();
  if (!price) errors.asking_price_aud = 'Asking price is required.';
  else if (price.startsWith('-')) errors.asking_price_aud = 'Asking price cannot be negative.';
  else if (!PRICE_PATTERN.test(price)) {
    errors.asking_price_aud = /^\d+\.\d{3,}$/.test(price)
      ? 'Asking price can have at most two decimal places.'
      : 'Asking price must be a number in dollars, for example 95 or 95.50. Do not include $ or commas.';
  } else if (Number(price) > 1000000) errors.asking_price_aud = 'Asking price must be $1,000,000 or less.';
  else offer.asking_price_aud = price; // sent as text so no rounding happens

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, offer: { ...offer, status: 'new' } };
}
