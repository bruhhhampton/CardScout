// Turns a saved assessment (and the AI run behind it) into short, plain-English lines for staff.
// Plain code, no AI: the same assessment always reads the same way. Uses Cerf's own scales
// (football: 50 not yet proven, 65 repeated evidence, 80 consistently outstanding, 90 top of age group).

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;

export function headline(a, asking) {
  const max = a.offer_ceiling_aud == null ? null : Number(a.offer_ceiling_aud);
  switch (a.outcome) {
    case 'eligible': return { title: `OK to buy at ${money(asking)}`, tone: 'eligible' };
    case 'counteroffer': return { title: `Offer up to ${money(max)}`, tone: 'counteroffer' };
    case 'decline': return { title: "Don't buy", tone: 'decline' };
    default: return { title: 'Ask Cerf first', tone: 'owner_review' };
  }
}

// What the card is worth, and where that number came from.
export function marketValue(a, run) {
  // Follow what the rules used: the price guide when they said so, otherwise real sales first.
  const usedGuide = (a.reasons ?? []).some((r) => /price guide value of|^Market value from the SportsCardsPro price guide/.test(r));
  if (usedGuide && run?.price_guide?.found && run.price_guide.value_aud != null) {
    return { value: Number(run.price_guide.value_aud), from: 'SportsCardsPro price guide' };
  }
  if (a.median_sold_aud != null && Number(a.sales_count) > 0) {
    return { value: Number(a.median_sold_aud), from: `middle of ${a.sales_count} recent sale${Number(a.sales_count) === 1 ? '' : 's'}` };
  }
  if (run?.price_guide?.found && run.price_guide.value_aud != null) {
    return { value: Number(run.price_guide.value_aud), from: 'SportsCardsPro price guide' };
  }
  return null;
}

// The three prices staff compare: the most Cerf pays, the asking price and what it is worth.
export function ladder(a, run, asking) {
  const worth = marketValue(a, run);
  const points = [
    a.offer_ceiling_aud != null && { key: 'max', label: 'Most we pay', value: Number(a.offer_ceiling_aud) },
    { key: 'asking', label: 'Seller asks', value: Number(asking) },
    worth && { key: 'worth', label: 'Worth about', value: worth.value },
  ].filter(Boolean);
  if (points.length < 2) return null;
  const lo = Math.min(...points.map((p) => p.value)) * 0.9;
  const hi = Math.max(...points.map((p) => p.value)) * 1.1;
  return {
    points: points.map((p) => ({ ...p, text: money(p.value), at: hi > lo ? Math.round(((p.value - lo) / (hi - lo)) * 100) : 50 })),
    worthFrom: worth?.from ?? null,
  };
}

function footballWords(score) {
  if (score == null) return null;
  if (score >= 90) return 'top of his age group';
  if (score >= 80) return 'consistently outstanding';
  if (score >= 65) return 'proven: plays well week after week';
  if (score >= 50) return 'not yet proven';
  return 'not at the level Cerf buys';
}
function demandWords(score) {
  if (score == null) return null;
  if (score >= 85) return 'very high';
  if (score >= 70) return 'good';
  if (score >= 50) return 'some';
  return 'low';
}

// Four short lines that teach staff why this card is or is not a good buy.
export function whyLines(a, offer, run) {
  const lines = [];
  const football = a.football_real ?? a.score_football;
  const first = a.first_team === 'yes' ? 'Plays first-team football.' : a.first_team === 'no' ? 'No first-team chance right now.' : 'First-team chance not confirmed.';
  if (football != null) lines.push({ label: 'Player', text: `${cap(footballWords(football))} (${football}/100). ${first}` });
  const variant = String(offer.variant ?? '').trim();
  const version = /^base$/i.test(variant) || !variant ? 'the common base version' : `the ${variant} version`;
  const rookie = a.rookie_card === 'yes' ? 'His official rookie card' : a.rookie_card === 'no' ? 'Not a rookie card' : 'Rookie card not confirmed';
  lines.push({ label: 'Card', text: `${rookie}, ${version}.` });
  const perYear = run?.price_guide?.found ? run.price_guide.sales_per_year : null;
  if (a.score_collector != null) lines.push({ label: 'Demand', text: `${cap(demandWords(a.score_collector))} collector demand${perYear ? `: about ${perYear} sell each year` : ''}.` });
  const worth = marketValue(a, run);
  if (worth) {
    const diff = Math.round(((Number(offer.asking_price_aud) - worth.value) / worth.value) * 100);
    const where = diff === 0 ? 'the same as' : diff > 0 ? `${diff}% above` : `${-diff}% below`;
    lines.push({ label: 'Price', text: `The asking price is ${where} what it is worth (${money(worth.value)}, from the ${worth.from}).` });
  } else {
    lines.push({ label: 'Price', text: 'No recent sales or price guide value, so its worth is not proven yet.' });
  }
  return lines;
}

// Rule reasons rewritten for staff: what stops this being a simple yes.
export function holdUps(a) {
  if (a.outcome === 'eligible') return [];
  return (a.reasons ?? [])
    .filter((r) => !/^Asking .* within/.test(r) && !/A person must still confirm/.test(r) && !/^Market value from the SportsCardsPro price guide/.test(r))
    .map((r) => r
      .replace(/^Only (\d+) matching sale\(s\), so the SportsCardsPro price guide value of (\$[\d.,]+) was used.*$/, (m, n, v) => `Only ${n} recent sale${n === '1' ? '' : 's'}, so CardScout used the SportsCardsPro price guide (${v}).`)
      .replace(/^Asking (\$[\d.,]+) is above your offer ceiling of (\$[\d.,]+).*$/, 'The seller wants $1, more than the most Cerf pays for it ($2).')
      .replace(/^Only (\d+) matching sale\(s\) in the last (\d+) days; you need at least (\d+)$/, 'Only $1 recent sale(s) in the last $2 days. Cerf wants at least $3 before staff buy.')
      .replace(/^CERF watch: /, 'Not a strong enough buy yet: ')
      .replace(/^CERF speculative: /, 'Too uncertain: ')
      .replace(/^CERF expensive: /, 'Too pricey: ')
      .replace(/^CERF: /, '')
      .replace(/your attractive level/g, "Cerf's level")
      .replace(/; counteroffer up to .*$/, ''));
}

// Words staff can say to the seller. Never shows Cerf's margin, scores or the price guide figure.
export function sellerWords(a, asking) {
  const max = a.offer_ceiling_aud == null ? null : money(Number(a.offer_ceiling_aud));
  switch (a.outcome) {
    case 'eligible': return `Thanks, we can take this card at your price of ${money(asking)}.`;
    case 'counteroffer': return `Thanks for bringing it in. Based on recent sales of this card and what we can resell it for, the best we can offer is ${max}.`;
    case 'decline': return "Thanks for showing us. It isn't a card we're buying at the moment.";
    default: return "Thanks. We need to check this one with the owner, and we'll get back to you shortly.";
  }
}
