// SportsCardsPro price guide: plain helpers with no network, so they can be tested.
// Their data is an estimated value per grade, not a sale. CardScout shows it beside real
// sales and only counts it as evidence if the owner allows that in Owner settings.

const STOP = new Set(['prizm', 'parallel', 'card', 'the', 'variant', 'base', 'rookie', 'rc']);
const plain = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (t) => plain(t).replace(/\/\s*\d+/g, ' ').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

// The search text that found the right card in our tests: player, card number, first 3 set words,
// and the variant unless it is the base card.
export function buildQuery(offer) {
  const set = String(offer?.set_name ?? '').split(/\s+/).slice(0, 3).join(' ');
  const variant = words(offer?.variant).join(' ');
  const number = String(offer?.card_number ?? '').replace(/^#/, '');
  return [offer?.player, number, set, variant].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// "Lamine Yamal [Silver] #70" -> { name: 'Lamine Yamal', variant: 'Silver', number: '70' }
export function parseProductName(name) {
  const m = String(name ?? '').match(/^(.*?)\s*(?:\[([^\]]+)\])?\s*#\s*(\S+)\s*$/);
  if (!m) return { name: String(name ?? '').trim(), variant: '', number: '' };
  return { name: m[1].trim(), variant: (m[2] ?? '').trim(), number: m[3].trim() };
}

function sameVariant(offerVariant, productVariant) {
  const a = words(offerVariant).sort().join(' ');
  const b = words(productVariant).sort().join(' ');
  return a === b;
}

// Picks the product that is the exact card: same player, number, variant and (if given) year.
// Returns { product, exact: true } or { product: null, exact: false, candidates }.
export function pickProduct(products, offer) {
  const list = Array.isArray(products) ? products : [];
  const number = plain(String(offer?.card_number ?? '').replace(/^#/, '')).trim();
  const player = plain(offer?.player).replace(/\s+/g, ' ').trim();
  const year = String(offer?.year ?? '').trim();
  const matches = list.filter((p) => {
    const parsed = parseProductName(p['product-name']);
    return plain(parsed.number) === number
      && plain(parsed.name).replace(/\s+/g, ' ').trim() === player
      && (!year || String(p['console-name'] ?? '').includes(year))
      && sameVariant(offer?.variant, parsed.variant);
  });
  if (matches.length) return { product: matches[0], exact: true, candidates: [] };
  return { product: null, exact: false, candidates: list.slice(0, 5).map((p) => `${p['product-name']} (${p['console-name']})`) };
}

// Which price field matches the grade staff entered. Unknown grades return null.
const GRADES = [
  [/^(raw|ungraded|ungraded.*|near mint.*|nm.*|)$/i, 'loose-price', 'Ungraded'],
  [/psa\s*10/i, 'manual-only-price', 'PSA 10'],
  [/bgs\s*10\s*black/i, 'condition-20-price', 'BGS 10 Black'],
  [/bgs\s*10/i, 'bgs-10-price', 'BGS 10'],
  [/cgc\s*10/i, 'condition-17-price', 'CGC 10'],
  [/sgc\s*10/i, 'condition-18-price', 'SGC 10'],
  [/\b9\.5\b/, 'box-only-price', 'Grade 9.5'],
  [/\b9\b/, 'graded-price', 'Grade 9'],
  [/\b8(\.5)?\b/, 'new-price', 'Grade 8'],
  [/\b7(\.5)?\b/, 'cib-price', 'Grade 7'],
];
export function gradeField(gradeCondition) {
  const g = String(gradeCondition ?? '').trim();
  for (const [re, key, label] of GRADES) if (re.test(g)) return { key, label };
  return null;
}

const usd = (cents) => (cents == null || cents === '' || !Number.isFinite(Number(cents)) ? null : Math.round(Number(cents)) / 100);

// Turns an API product into what CardScout stores and shows. rate = A$ per US$, adjust = owner's share.
export function summariseProduct(product, offer, { rate = null, adjust = 1 } = {}) {
  const grade = gradeField(offer?.grade_condition);
  const toAud = (v) => (v == null || !(rate > 0) ? null : Math.round(v * rate * adjust * 100) / 100);
  const value = grade ? usd(product[grade.key]) : null;
  // Suggested shop buy and sell prices are only given for ungraded, 7 and 8.
  const retail = grade?.key === 'loose-price' ? 'loose' : grade?.key === 'cib-price' ? 'cib' : grade?.key === 'new-price' ? 'new' : null;
  const buy = retail ? usd(product[`retail-${retail}-buy`]) : null;
  const sell = retail ? usd(product[`retail-${retail}-sell`]) : null;
  return {
    found: true,
    id: String(product.id ?? ''),
    name: product['product-name'] ?? '',
    set: product['console-name'] ?? '',
    grade: grade?.label ?? null,
    value_usd: value,
    value_aud: toAud(value),
    suggested_buy_usd: buy,
    suggested_buy_aud: toAud(buy),
    suggested_sell_usd: sell,
    suggested_sell_aud: toAud(sell),
    sales_per_year: product['sales-volume'] == null ? null : Number(product['sales-volume']),
    rate, adjust,
    link: product.id ? `https://www.pricecharting.com/game/${product.id}` : null,
  };
}
