import { shopFlags } from './assess.mjs';
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
    default: return { title: 'Ask the owner first', tone: 'owner_review' };
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
  return 'not at the level the shop buys';
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

// Shop rule reasons in plain words for staff.
export function plainReason(r) {
  return String(r)
    .replace(/^Base card: base cards sell cheaply, and your setting is to not buy them$/, "Base card. The shop doesn't buy base cards because they sell cheaply.")
    .replace(/^Base card: base cards sell cheaply, and your setting is to decide on them yourself$/, 'Base card. Base cards sell cheaply, so the owner decides.')
    .replace(/^(.+) card: you buy (.+)$/, '$1 card. The shop buys $2.')
    .replace(/^The maker of "(.+)" could not be told from the set name; you buy (.+)$/, 'Maker of "$1" not clear from the set name. The shop buys $2.')
    .replace(/^Asking (\$[\d.,]+) is above (\$[\d.,]+); expensive cards are harder to resell$/, 'Asking $1 is above $2. Expensive cards are harder to resell.')
    .replace(/^Only about (\d+) copies sell each year \(your level is (\d+)\), so it may be slow to resell$/, 'Only about $1 copies sell each year, below the shop\'s level of $2, so it may be slow to resell.')
    .replace(/^The card has a defect; you judge whether it matters$/, 'The card has a defect. The owner decides whether it matters.');
}

// Rule reasons rewritten for staff: what stops this being a simple yes.
export function holdUps(a) {
  if (a.outcome === 'eligible') return [];
  return (a.reasons ?? [])
    .filter((r) => !/^Asking .* within/.test(r) && !/A person must still confirm/.test(r) && !/^Market value from the SportsCardsPro price guide/.test(r))
    .map((r) => r
      .replace(/^Only (\d+) matching sale\(s\), so the SportsCardsPro price guide value of (\$[\d.,]+) was used.*$/, (m, n, v) => `Only ${n} recent sale${n === '1' ? '' : 's'}, so CardScout used the SportsCardsPro price guide (${v}).`)
      .replace(/^Asking (\$[\d.,]+) is above your offer ceiling of (\$[\d.,]+).*$/, 'The seller wants $1, more than the most the shop pays for it ($2).')
      .replace(/^Only (\d+) matching sale\(s\) in the last (\d+) days; you need at least (\d+)$/, 'Only $1 recent sale(s) in the last $2 days. The owner wants at least $3 before staff buy.')
      .replace(/; you decide whether it is a real one worth buying$/, '. The owner decides whether it matters.')
      .replace(/; expensive cards are hard to resell, so you decide$/, '. Expensive cards are hard to resell, so the owner decides.')
      .replace(/^.*$/, (r) => plainReason(r))
      .replace(/^CERF watch: /, 'Not a strong enough buy yet: ')
      .replace(/^CERF speculative: /, 'Too uncertain: ')
      .replace(/^CERF expensive: /, 'Too pricey: ')
      .replace(/^CERF: /, '')
      .replace(/your (attractive|strong-buy) level/g, "the strong-buy level")
      .replace(/^CERF attractive: /, "Strong buy: ")
      .replace(/CERF total/g, "Buying score")
      .replace(/^Player: /, "")
      .replace(/^Too pricey for the player: /, "Too pricey: ")
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

// ---------------------------------------------------------------------------
// "How CardScout worked this out": the same four questions Cerf asks, in order, with what
// CardScout found, the sums it did and one line on why Cerf cares. Staff learn the method by
// reading it on a real card. Plain code: every number comes from the saved assessment, the AI
// run and the owner settings used at the time.

const pct = (x) => `${Math.round(Number(x) * 100)}%`;
const exact = (n) => `$${Number(n).toFixed(2)}`;
const floorCents = (n) => Math.floor((n + 1e-9) * 100) / 100;
const worst = (rows) => (rows.some((r) => r.status === 'stop') ? 'stop' : rows.some((r) => r.status === 'check') ? 'check' : 'pass');

function check(draft, name) {
  const c = draft?.checks?.[name] ?? {};
  return { reason: c.reason ?? '', sources: c.sources ?? [] };
}

function stepRules(a, offer, s, draft, run) {
  const rows = [];
  const excluded = String(s.excluded_sets ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const setOut = excluded.includes(String(offer.set_name ?? '').trim().toLowerCase());
  rows.push({ label: 'Set', status: setOut ? 'stop' : 'pass', text: setOut ? `${offer.set_name} is on the shop's list of sets it does not buy.` : `${offer.set_name} is not on the shop's list of sets it does not buy.` });
  const cond = { acceptable: ['pass', 'Meets the shop\'s condition standard.'], not_acceptable: ['stop', 'Below the shop\'s condition standard.'], defect: ['check', 'Has a defect. The owner decides whether it matters.'], unsure: ['check', 'Condition not checked yet.'] }[a.condition] ?? ['check', 'Condition not checked yet.'];
  rows.push({ label: 'Condition', status: cond[0], text: cond[1] });
  // Cerf's shop rules: each one he set to Ask me or Don't buy that applies to this card.
  const LABEL = { base_rule: 'Base card', maker_rule: 'Maker', price_rule: 'Price', slow_rule: 'Slow seller', defect_rule: 'Defect' };
  const flags = shopFlags(offer, { condition: a.condition, sales_per_year: run?.price_guide?.found ? run.price_guide.sales_per_year : null }, s);
  for (const f of flags) {
    rows.push({ label: LABEL[f.rule], status: f.mode === 'decline' ? 'stop' : 'check', text: `${plainReason(f.reason)} The owner's setting: ${f.mode === 'decline' ? "don't buy" : 'ask the owner'}.` });
  }
  const rookieOn = s.rookie_only !== false;
  const rc = check(draft, 'rookie_card');
  rows.push({
    label: 'Rookie card',
    status: !rookieOn ? 'pass' : a.rookie_card === 'yes' ? 'pass' : a.rookie_card === 'no' ? 'stop' : 'check',
    text: (!rookieOn ? 'Rule switched off in Owner settings. ' : '') + (a.rookie_card === 'yes' ? 'Yes, his official rookie card.' : a.rookie_card === 'no' ? 'No, not his rookie card.' : 'Not confirmed.') + (rc.reason ? ` ${rc.reason}` : ''),
    sources: rc.sources,
  });
  const ft = check(draft, 'first_team');
  rows.push({
    label: 'First team',
    status: a.first_team === 'yes' ? 'pass' : a.first_team === 'no' ? 'stop' : 'check',
    text: (a.first_team === 'yes' ? 'Yes, he plays first-team football.' : a.first_team === 'no' ? 'No first-team chance right now.' : 'Not confirmed.') + (ft.reason ? ` ${ft.reason}` : ''),
    sources: ft.sources,
  });
  const stock = Number(a.stock_count ?? 0);
  const max = Number(s.max_copies);
  rows.push({ label: 'Stock', status: stock + 1 > max ? 'stop' : 'pass', text: `${stock} in stock. The shop holds at most ${max}, so ${stock + 1 > max ? 'one more is too many' : 'one more is fine'}.` });
  return {
    key: 'rules', title: 'Can the shop buy this kind of card?', status: worst(rows), rows,
    lesson: 'The shop buys official rookie cards of players getting first-team minutes, and the owner sets the rules for base cards, makers, price and defects. Rookie cards are the version collectors chase, and minutes are what move a player\'s price. Any "no" here ends it straight away.',
  };
}

function stepWorth(a, run, s) {
  const rows = [];
  const g = run?.price_guide;
  const used = marketValue(a, run);
  if (g?.found && g.value_usd != null) {
    const sum = g.value_aud != null ? ` US$${g.value_usd.toFixed(2)} × A$${g.rate} per US$ × ${pct(g.adjust ?? 1)} overseas share = ${exact(g.value_aud)}.` : ' Today\'s exchange rate could not be loaded, so it was not used.';
    rows.push({ label: 'Price guide', status: g.value_aud != null ? 'pass' : 'check', text: `SportsCardsPro values ${/^[aeiou]/i.test(String(g.grade)) ? 'an' : 'a'} ${/^ungraded$/i.test(g.grade) ? 'ungraded' : g.grade} copy at US$${g.value_usd.toFixed(2)}.${sum}`, sources: g.link ? [g.link] : [] });
    if (g.suggested_buy_aud != null) rows.push({ label: 'Shop buy price', status: 'info', text: `SportsCardsPro suggests a shop pays about ${exact(g.suggested_buy_aud)} for it. Useful as a sense check.` });
    const minYear = Number(s.min_sales_per_year ?? 0);
    const slowOn = ['ask', 'decline'].includes(s.slow_rule);
    if (g.sales_per_year != null && slowOn && minYear > 0 && g.sales_per_year < minYear) rows.push({ label: 'How often it sells', status: s.slow_rule === 'decline' ? 'stop' : 'check', text: `Only about ${g.sales_per_year} copies sell each year, below the shop's level of ${minYear}, so it may be slow to resell.` });
    else if (g.sales_per_year != null) rows.push({ label: 'How often it sells', status: 'info', text: `About ${g.sales_per_year} copies sell each year, so it is ${g.sales_per_year >= 100 ? 'easy' : g.sales_per_year >= 20 ? 'fairly easy' : 'slow'} to resell.` });
  } else if (g) {
    rows.push({ label: 'Price guide', status: 'check', text: g.options?.length ? 'SportsCardsPro does not list this exact version. Pick the version on the card at the top of the page to use its price.' : (g.reason ?? 'Not found on SportsCardsPro.') });
  }
  const n = Number(run?.sales_count ?? a.sales_count ?? 0);
  const median = run?.median_sold_aud ?? a.median_sold_aud;
  rows.push({
    label: 'Real sales',
    status: n >= Number(s.min_sales) ? 'pass' : used?.from === 'SportsCardsPro price guide' ? 'info' : 'check',
    text: n ? `${n} matching sale${n === 1 ? '' : 's'} found, middle price ${exact(median)}.` : `No matching sold listings found in the last ${s.sales_window_days} days.`,
  });
  const fromGuide = used?.from === 'SportsCardsPro price guide';
  const tooFew = used && !fromGuide && n < Number(s.min_sales);
  return {
    key: 'worth', title: 'What is it worth?', status: used && !tooFew ? 'pass' : 'check', rows,
    result: !used ? 'No value could be proven, so the owner has to decide.'
      : tooFew ? `Only ${n} sale${n === 1 ? '' : 's'}. The owner wants at least ${s.min_sales} before staff buy, so the owner decides. The middle price was ${exact(used.value)}.`
      : `CardScout used ${exact(used.value)}, from the ${used.from}.`,
    lesson: 'Worth is what the shop can resell the card for, not what the seller asks. A price guide is an estimate, real sold listings are proof, so open one or two sales when you have a minute.',
  };
}

const SCORES = [
  ['football', 'score_football', 'Football quality', 'w_football'],
  ['career', 'score_career', 'Career path', 'w_career'],
  ['collector', 'score_collector', 'Collector appeal', 'w_collector'],
  ['card', 'score_card', 'Card quality', 'w_card'],
  ['valuation', 'score_valuation', 'Price fairness', 'w_valuation'],
];
const CATEGORY = {
  ATTRACTIVE: ['pass', 'Strong buy'],
  WATCH: ['check', 'Not strong enough yet'],
  SPECULATIVE: ['check', 'Too uncertain'],
  EXPENSIVE: ['check', 'Too pricey for the player'],
  REJECT: ['stop', 'Not a player the shop buys'],
};

function stepPlayer(a, s, draft) {
  const rows = SCORES.map(([key, col, label, w]) => {
    const score = Number(a[col]);
    const d = draft?.scores?.[key] ?? {};
    return { label, score, weight: Number(s[w]), text: d.reason ?? '', sources: d.sources ?? [], status: 'score' };
  });
  const parts = rows.map((r) => `${r.score} × ${r.weight}%`).join(' + ');
  const [status, words] = CATEGORY[a.cerf_category] ?? ['check', 'Not worked out'];
  return {
    key: 'player', title: 'Is the player worth backing?', status, rows,
    maths: [`${parts} = ${Number(a.cerf_total).toFixed(1)} out of 100`],
    result: `${words}. The owner calls ${s.attractive_total_min} or more a strong buy, as long as price fairness is at least ${s.attractive_valuation_min}.`,
    lesson: `The owner weighs football quality most (${s.w_football}%), because a player who keeps performing keeps his cards rising. Collector appeal and career path tell you how many buyers there will be later.`,
  };
}

function stepPrice(a, run, s, asking) {
  const used = marketValue(a, run);
  if (!used || a.offer_ceiling_aud == null) {
    return { key: 'price', title: 'What is the most the shop pays?', status: 'check', rows: [], result: 'Without a proven value there is no safe price, so the owner decides.', lesson: 'Never guess a price. If the worth is not proven, ask the owner.' };
  }
  const v = used.value;
  const fraction = Number(s.offer_fraction);
  const margin = Number(s.min_margin);
  const costs = Number(s.selling_costs_aud ?? 0);
  const a1 = floorCents(fraction * v);
  const a2 = floorCents((1 - margin) * v - costs);
  const max = Number(a.offer_ceiling_aud);
  const limit = Number(s.staff_limit_aud);
  const gap = asking - max;
  return {
    key: 'price', title: 'What is the most the shop pays?',
    status: gap > 0 || asking > limit ? 'check' : 'pass', rows: [],
    maths: [
      `Pay at most ${pct(fraction)} of worth: ${pct(fraction)} × ${exact(v)} = ${exact(a1)}`,
      `Keep a ${pct(margin)} margin after selling costs: ${pct(1 - margin)} × ${exact(v)} − ${exact(costs)} = ${exact(a2)}`,
      `Most the shop pays is the lower one: ${exact(max)}`,
    ],
    result: gap > 0
      ? `The seller asks ${exact(asking)}, ${exact(gap)} too much. ${max > limit ? `A counteroffer would pass the ${exact(limit)} staff limit, so the owner decides.` : `Offer up to ${exact(max)}.`}`
      : `The seller asks ${exact(asking)}, within the most the shop pays${asking > limit ? `, but over the ${exact(limit)} staff limit, so the owner decides` : ''}.`,
    lesson: 'The gap between worth and what the shop pays covers selling fees, postage and the risk the price drops before it sells. Staff can agree any price up to this number without asking.',
  };
}

export function walkthrough(a, run, offer, settings) {
  if (!a) return [];
  const s = { ...settings, ...(a.settings_snapshot ?? {}) };
  const draft = run?.status === 'completed' ? run.draft : null;
  const asking = Number(offer.asking_price_aud);
  const steps = [stepRules(a, offer, s, draft, run), stepWorth(a, run, s), stepPlayer(a, s, draft), stepPrice(a, run, s, asking)];
  // Once a step stops the card, later steps are still shown so staff learn the whole method.
  const stopAt = steps.findIndex((x) => x.status === 'stop');
  return steps.map((x, i) => ({ ...x, n: i + 1, afterStop: stopAt >= 0 && i > stopAt ? stopAt + 1 : null }));
}

export const STATUS_WORDS = { pass: 'Passed', check: 'Needs a look', stop: 'Stops here', info: '', score: '' };

// ---------------------------------------------------------------------------
// "The player": real facts with their sources, for staff who cannot watch every league.
const FACT_LABEL = {
  age: 'Age', club: 'Club', league: 'League', position: 'Position', appearances: 'Appearances',
  starts: 'Starts', minutes: 'Minutes', goals: 'Goals', assists: 'Assists', caps: 'International caps',
};
const STAGE = {
  prospect: 'Prospect: young and still breaking through, so a bigger gamble with more upside',
  established: 'Established: a regular starter, so his cards are steadier',
  unsure: null,
};
export function playerBox(run) {
  const f = run?.status === 'completed' ? run.draft?.player_facts : null;
  if (!f) return null;
  const rows = Object.keys(FACT_LABEL).map((k) => ({ key: k, label: FACT_LABEL[k], value: f[k]?.value ?? null, source: f[k]?.source ?? null }));
  const found = rows.filter((r) => r.value);
  if (!found.length && f.stage === 'unsure') return null;
  const pick = (k) => rows.find((r) => r.key === k)?.value;
  const summary = [pick('age') && `${pick('age')}`, pick('club'), pick('appearances') && `${pick('appearances')} apps`, pick('goals') && `${pick('goals')} goals`].filter(Boolean).join(' · ');
  return { season: f.season || null, stage: STAGE[f.stage] ?? null, rows, summary, missing: rows.length - found.length };
}

// "The market": what SportsCardsPro says about the card, in plain numbers.
export function marketBox(run, offer) {
  const g = run?.price_guide;
  if (!g || !g.found) return null;
  const grades = (g.grades ?? []).map((x) => ({ ...x, mine: x.label === g.grade }));
  const versions = (g.versions ?? []).filter(Boolean);
  const speed = g.sales_per_year == null ? null : g.sales_per_year >= 100 ? 'sells easily' : g.sales_per_year >= 20 ? 'sells steadily' : 'sells slowly';
  return {
    name: g.name, set: g.set, link: g.link, grade: g.grade,
    grades,
    salesPerYear: g.sales_per_year, speed,
    buy: g.suggested_buy_aud, sell: g.suggested_sell_aud,
    versions, thisVersion: String(offer?.variant ?? '').trim() || 'Base',
    summary: [g.value_aud != null && `${money(g.value_aud)} ${String(g.grade).toLowerCase()}`, g.sales_per_year != null && `${g.sales_per_year} sold a year`, versions.length > 1 && `${versions.length} versions`].filter(Boolean).join(' · '),
  };
}
