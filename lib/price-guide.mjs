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

// Player names differ between sources: "Min-hyeok Yang" vs "Yang Min-hyeok" vs "Yang Minhyeok",
// "Vinícius Júnior" vs "Vinicius Jr". Names count as the same player when they have the same words in
// any order, ignoring accents, hyphens, dots and Jr/Junior.
const SUFFIX = { jr: 'junior', jnr: 'junior' };
function nameKeys(name) {
  const base = plain(name).replace(/[.'’]/g, '');
  const split = base.replace(/-/g, ' ').split(/[^a-z0-9]+/).filter(Boolean).map((w) => SUFFIX[w] ?? w);
  const joined = base.replace(/-/g, '').split(/[^a-z0-9]+/).filter(Boolean).map((w) => SUFFIX[w] ?? w);
  return new Set([split.slice().sort().join(' '), joined.slice().sort().join(' '), split.join('')].filter(Boolean));
}
const nameWords = (name) => plain(name).replace(/[.'’]/g, '').replace(/-/g, ' ').split(/[^a-z0-9]+/).filter(Boolean).map((w) => SUFFIX[w] ?? w);
export function samePlayer(a, b) {
  const x = nameKeys(a);
  for (const k of nameKeys(b)) if (x.has(k)) return true;
  return false;
}
// A shorter card name that is part of his full name ("Rodrygo" in "Rodrygo Silva de Goes").
// Never counted as his card automatically; shown as "may be his" for staff to check.
export function maybePlayer(fullName, cardName) {
  if (samePlayer(fullName, cardName)) return false;
  const full = new Set(nameWords(fullName));
  const words = nameWords(cardName);
  return words.length > 0 && words.every((w) => full.has(w)) && words.some((w) => w.length >= 4);
}

// Picks the product that is the exact card: same player, number, variant and (if given) year.
// Returns { product, exact: true } or { product: null, exact: false, candidates }.
export function pickProduct(products, offer) {
  const list = Array.isArray(products) ? products : [];
  const number = plain(String(offer?.card_number ?? '').replace(/^#/, '')).trim();
  const player = offer?.player ?? '';
  const year = String(offer?.year ?? '').trim();
  const matches = list.filter((p) => {
    const parsed = parseProductName(p['product-name']);
    return plain(parsed.number) === number
      && samePlayer(parsed.name, player)
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
    if (plain(parsed.number) !== number || !samePlayer(parsed.name, player)) return false;
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
  const player = card?.player ?? '';
  const year = String(card?.year ?? '').trim();
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const parsed = parseProductName(p['product-name']);
    if (plain(parsed.number) !== number || !samePlayer(parsed.name, player)) continue;
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

// "Soccer Cards 2023 Topps Chrome UEFA Club" + "Lamine Yamal [Gold] #64" -> the fields of an offer,
// so staff can send a card from a player's profile straight to the scan form.
export function cardFromProduct(p) {
  const parsed = parseProductName(p?.['product-name']);
  const consoleName = String(p?.['console-name'] ?? '').replace(/^Soccer Cards\s+/i, '').trim();
  const m = consoleName.match(/^(\d{4})\s+(.*)$/);
  const cents = Number(p?.['loose-price']);
  return {
    id: String(p?.id ?? ''),
    player: parsed.name,
    year: m ? m[1] : '',
    set_name: m ? m[2] : consoleName,
    card_number: parsed.number,
    variant: parsed.variant || 'Base',
    title: `${m ? m[1] : ''} ${m ? m[2] : consoleName} #${parsed.number}${parsed.variant ? ` · ${parsed.variant}` : ''}`.trim(),
    loose_usd: Number.isFinite(cents) && cents > 0 ? cents / 100 : null,
    sales_per_year: Number.isFinite(Number(p?.['sales-volume'])) && p?.['sales-volume'] !== '' && p?.['sales-volume'] != null ? Number(p['sales-volume']) : null,
  };
}

// Marks his best cards so staff do not face a random list.
// Hot: his most-sold cards, only when SportsCardsPro's sales a year back it up (at least 20 a year).
// Rookie year: cards from his first season in the list, which collectors want most.
// Order: hot rookie-year cards, then other hot cards, then rookie year, then the rest (newest first).
export const HOT_MIN_PER_YEAR = 20;
export function rankCards(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const years = list.map((c) => Number(c.year)).filter((y) => y > 1900);
  const first = years.length ? Math.min(...years) : null;
  const volumes = list.map((c) => c.sales_per_year ?? 0).filter((v) => v >= HOT_MIN_PER_YEAR).sort((a, b) => b - a);
  const hotLine = volumes.length ? volumes[Math.min(1, volumes.length - 1)] : Infinity;
  const ranked = list.map((c) => ({
    ...c,
    rookie_year: first != null && Number(c.year) === first,
    hot: (c.sales_per_year ?? 0) >= HOT_MIN_PER_YEAR && (c.sales_per_year ?? 0) >= hotLine,
  }));
  const score = (c) => (c.hot ? 2 : 0) + (c.rookie_year ? 1 : 0);
  return ranked.sort((a, b) => score(b) - score(a) || (b.sales_per_year ?? 0) - (a.sales_per_year ?? 0) || Number(b.year || 0) - Number(a.year || 0));
}

// A player's cards from a SportsCardsPro search: his own (same name in any order), newest sets first.
export function cardsForPlayer(products, name) {
  return (Array.isArray(products) ? products : [])
    .filter((p) => samePlayer(parseProductName(p['product-name']).name, name))
    .map(cardFromProduct)
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, 20);
}

// Cards under a shorter name that is part of his full name, for staff to check. At most 10.
export function maybeCardsForPlayer(products, name) {
  return (Array.isArray(products) ? products : [])
    .filter((p) => maybePlayer(name, parseProductName(p['product-name']).name))
    .map(cardFromProduct)
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, 10);
}
