// SportsCardsPro price guide: plain helpers with no network, so they can be tested.
// Their data is an estimated value per grade, not a sale. CardScout shows it beside real
// sales and only counts it as evidence if the owner allows that in Owner settings.

const STOP = new Set(['prizm', 'parallel', 'card', 'the', 'variant', 'base', 'rookie', 'rc', 'numbered', 'logo', 'serial', 'version', 'of']);
const plain = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Serial numbers (218/399) and stray numbers are dropped: they say which copy it is, not which version.
const words = (t) => plain(t).replace(/\d+\s*\/\s*\d+/g, ' ').replace(/\/\s*\d+/g, ' ').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));

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
  // Similar versions: same player, number and year, and one version's words all appear in the other's
  // (for example "Green Wave" and "Green Wave Refractor"). Never used for the price, because they can be
  // different cards with different prices. They are only suggested so staff can check the card.
  const mine = new Set(words(offer?.variant));
  const close = list.filter((p) => {
    const parsed = parseProductName(p['product-name']);
    if (plain(parsed.number) !== number || plain(parsed.name).replace(/\s+/g, ' ').trim() !== player) return false;
    if (year && !String(p['console-name'] ?? '').includes(year)) return false;
    const theirs = words(parsed.variant);
    if (!theirs.length || !mine.size) return false;
    return theirs.every((w) => mine.has(w)) || [...mine].every((w) => theirs.includes(w));
  });
  if (close.length) return { product: null, exact: false, similar: close.slice(0, 5).map((p) => `${p['product-name']} (${p['console-name']})`), candidates: list.slice(0, 5).map((p) => `${p['product-name']} (${p['console-name']})`) };
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
  // Value for every grade SportsCardsPro gives, so staff see what grading would be worth.
  const grades = [['Ungraded', 'loose-price'], ['Grade 7', 'cib-price'], ['Grade 8', 'new-price'], ['Grade 9', 'graded-price'], ['Grade 9.5', 'box-only-price'], ['PSA 10', 'manual-only-price']]
    .map(([label, key]) => ({ label, usd: usd(product[key]), aud: toAud(usd(product[key])) }))
    .filter((g) => g.usd != null);
  return {
    found: true,
    grades,
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

// Every version SportsCardsPro lists for the same player, card number and year, so staff can tap
// the one in their hand (Base, Silver, Gold /50 ...). Returns [{ variant, name, set }].
export function variantsFor(products, card) {
  const list = Array.isArray(products) ? products : [];
  const number = plain(String(card?.card_number ?? '').replace(/^#/, '')).trim();
  const player = plain(card?.player).replace(/\s+/g, ' ').trim();
  const year = String(card?.year ?? '').trim();
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const parsed = parseProductName(p['product-name']);
    if (plain(parsed.number) !== number || plain(parsed.name).replace(/\s+/g, ' ').trim() !== player) continue;
    if (year && !String(p['console-name'] ?? '').includes(year)) continue;
    const variant = parsed.variant || 'Base';
    const key = `${variant}|${p['console-name']}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: String(p.id ?? ''), variant, name: p['product-name'], set: p['console-name'] ?? '' });
  }
  // Base first, then A to Z.
  return out.sort((a, b) => (a.variant === 'Base' ? -1 : b.variant === 'Base' ? 1 : a.variant.localeCompare(b.variant)));
}

// Button labels for the version picker. When two versions share a name (the same card in two sets,
// for example Topps Chrome and its Sapphire edition), the part of the set name that differs is added.
export function versionLabels(options) {
  const list = Array.isArray(options) ? options : [];
  const count = {};
  for (const o of list) count[o.variant] = (count[o.variant] ?? 0) + 1;
  const sets = list.map((o) => String(o.set ?? '').replace(/^Soccer Cards\s+/i, '').trim());
  const shared = (a, b) => { const x = a.split(' '); const y = b.split(' '); let i = 0; while (i < x.length && x[i] === y[i]) i += 1; return i; };
  return list.map((o, i) => {
    if (count[o.variant] < 2) return o.variant;
    const others = list.map((p, j) => (j !== i && p.variant === o.variant ? sets[j] : null)).filter(Boolean);
    const skip = Math.max(...others.map((t) => shared(sets[i], t)));
    // The plain set (whose name is part of the other's) is called standard.
    const extra = sets[i].split(' ').slice(skip).join(' ') || 'standard';
    return `${o.variant} (${extra})`;
  });
}
