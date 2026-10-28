// Builds the note for the AI from what staff pasted, so they never write the explanation.
// Staff give: the page the sales came from, the currency shown, and the copied sale rows.
export const PASTE_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR'];

export function describeCard(offer) {
  return [offer?.year, offer?.set_name, offer?.card_number ? `#${String(offer.card_number).replace(/^#/, '')}` : '', offer?.player, offer?.variant]
    .filter(Boolean).join(' ');
}

export function buildSalesNote(offer, { link = '', currency = '', rows = '' } = {}) {
  const pasted = String(rows).trim();
  if (!pasted) return '';
  const cur = PASTE_CURRENCIES.includes(currency) ? currency : 'AUD';
  let site = 'a sales website';
  try { site = new URL(link).hostname.replace(/^www\./, ''); } catch { /* no valid link */ }
  return [
    `Sold sales for this exact card (${describeCard(offer)}, as the seller describes it), copied by staff from ${site} with prices in ${cur}.`,
    'Where two prices are shown for one sale, the first is the sold price and the second was the asking price.',
    'Only record rows that are the same card (same player, set, number, variant and grade).',
    link ? `Page: ${link}` : 'Page: (no link given)',
    '',
    pasted.slice(0, 3000),
  ].join('\n');
}
