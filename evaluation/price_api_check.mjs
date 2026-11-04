// Checks the SportsCardsPro (PriceCharting) API before we build on it.
// Run in the Codespace, after adding SPORTSCARDSPRO_TOKEN=... to .env.local:
//   node --env-file=.env.local evaluation/price_api_check.mjs "Lamine Yamal 2023 Topps Chrome 64"
// It never prints the token. Prices come back in US cents and are shown in US dollars.
// Their limit is 1 call per second, so it waits between the two calls.
const token = process.env.SPORTSCARDSPRO_TOKEN;
// sportscardspro.com searches sports cards; pricecharting.com searches games and Funko Pops instead.
const base = process.env.PRICE_API_BASE || 'https://www.sportscardspro.com';
const query = process.argv.slice(2).join(' ').trim();

if (!token) {
  console.log('No SPORTSCARDSPRO_TOKEN found. Add it to .env.local, then run this again with --env-file=.env.local');
  process.exit(1);
}
if (!query) {
  console.log('Add a search, for example: node --env-file=.env.local evaluation/price_api_check.mjs "Lamine Yamal 2023 Topps Chrome 64"');
  process.exit(1);
}

const GRADES = [
  ['Ungraded', 'loose-price'],
  ['Grade 7', 'cib-price'],
  ['Grade 8', 'new-price'],
  ['Grade 9', 'graded-price'],
  ['Grade 9.5', 'box-only-price'],
  ['PSA 10', 'manual-only-price'],
];
const usd = (cents) => (Number.isFinite(Number(cents)) && cents !== null && cents !== '' ? `US$${(Number(cents) / 100).toFixed(2)}` : 'none');

async function get(path, params) {
  const url = `${base}${path}?${new URLSearchParams({ t: token, ...params })}`;
  const started = Date.now();
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const ms = Date.now() - started;
  let body;
  try { body = await res.json(); } catch { body = { status: 'error', 'error-message': `Not JSON (HTTP ${res.status})` }; }
  return { body, ms, http: res.status };
}

const search = await get('/api/products', { q: query });
console.log(`Search "${query}": HTTP ${search.http}, ${search.ms} ms`);
if (search.body.status !== 'success') {
  console.log('Error:', search.body['error-message'] ?? 'unknown');
  process.exit(1);
}
const list = search.body.products ?? [];
console.log(`${list.length} match(es):`);
list.slice(0, 10).forEach((p, i) => console.log(`  ${i + 1}. ${p['product-name']} | ${p['console-name']} | id ${p.id}`));
if (!list.length) process.exit(0);

await new Promise((r) => setTimeout(r, 1100)); // stay under 1 call per second
const one = await get('/api/product', { id: list[0].id });
console.log(`\nDetails for match 1: HTTP ${one.http}, ${one.ms} ms`);
if (one.body.status !== 'success') {
  console.log('Error:', one.body['error-message'] ?? 'unknown');
  process.exit(1);
}
const p = one.body;
console.log(`${p['product-name']} | ${p['console-name']}`);
for (const [label, key] of GRADES) console.log(`  ${label.padEnd(10)} ${usd(p[key])}`);
console.log(`  Sales per year: ${p['sales-volume'] ?? 'none'}`);
console.log(`  Suggested shop buy price (ungraded): ${usd(p['retail-loose-buy'])}`);
console.log(`  Suggested shop sell price (ungraded): ${usd(p['retail-loose-sell'])}`);
console.log(`  Fields returned: ${Object.keys(p).join(', ')}`);
