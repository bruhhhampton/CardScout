import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getOffer } from './offers';
import { getSettings } from './settings';
import { effectiveRates, getAudRates } from './fx.mjs';
import { lookupPriceGuide, priceGuideEnabled } from './price-guide';
import { getRecentPlayerResearch } from './agent-runs';
import { buildInstructions } from './agent-instructions.mjs';
import { checkDraft, checkSale, normaliseUrl, summariseSales, urlsInText, overseasRule } from './agent-checks.mjs';

// Bounded AI agent. It gathers evidence and drafts CERF scores with sources.
// It cannot decide outcomes, change rules, count sales, calculate prices or buy anything.
// The plain-code rules in lib/assess.mjs still make the decision after staff review.

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_SEARCHES = 5;
// With sales pasted by staff the agent only needs to research the player, so fewer searches are allowed.
export const SEARCHES_WITH_SALES = 3;
const MAX_STEPS = 10;

const allTools = (maxSearches) => [
  { type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches },
  {
    name: 'get_offer',
    description: 'Read the card offer being assessed: player, year, set, card number, variant, grade or condition as reported, asking price in AUD.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_owner_settings',
    description: "Read the owner's buying settings: limits, evidence needed (minimum sold sales and window in days) and buying-score weights and thresholds.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_price_guide',
    description: "Read SportsCardsPro's price guide for this exact card and grade: its estimated value, its suggested shop buy and sell prices and sales per year, already converted to AUD. An estimate, not a sale: never record it with record_sale.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_recent_player_research',
    description: "Read this player's football, career and collector scores, reasons and sources from another assessment in the last 24 hours, if there is one. Reuse them unless you find newer news.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'record_sale',
    description:
      'Record ONE sold comparable you found. Only real completed sales (sold, not asking or listed prices) of the exact same card: same player, year, set, card number, variant and grade. The url must come from your web search results or the staff notes. Never estimate or invent a price.',
    input_schema: {
      type: 'object',
      properties: {
        price: { type: 'string', description: 'Sold price as shown, for example 145.00' },
        currency: { type: 'string', description: 'Currency code as shown, for example AUD' },
        sold_date: { type: 'string', description: 'YYYY-MM-DD' },
        url: { type: 'string' },
        title: { type: 'string' },
        exact_match: { type: 'boolean', description: 'True only if every card detail matches' },
        is_lot: { type: 'boolean', description: 'True if a bundle or lot' },
        note: { type: 'string' },
      },
      required: ['price', 'currency', 'sold_date', 'url', 'title', 'exact_match', 'is_lot'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_draft',
    description: "Finish by submitting draft buying scores (0 to 100) with a short reason and source links for each, the owner's two checks with reasons and sources, plus questions staff must answer. Call this exactly once, last.",
    input_schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          properties: Object.fromEntries(
            ['football', 'career', 'collector', 'card', 'valuation'].map((k) => [
              k,
              {
                type: 'object',
                properties: {
                  score: { type: 'integer', minimum: 0, maximum: 100 },
                  reason: { type: 'string' },
                  sources: { type: 'array', items: { type: 'string' } },
                },
                required: ['score', 'reason', 'sources'],
                additionalProperties: false,
              },
            ])
          ),
          required: ['football', 'career', 'collector', 'card', 'valuation'],
          additionalProperties: false,
        },
        checks: {
          type: 'object',
          description: "the owner's two checks: rookie_card (recognised rookie card?) and first_team (first-team chance?).",
          properties: Object.fromEntries(
            ['rookie_card', 'first_team'].map((k) => [
              k,
              {
                type: 'object',
                properties: {
                  answer: { type: 'string', enum: ['yes', 'no', 'unsure'] },
                  reason: { type: 'string' },
                  sources: { type: 'array', items: { type: 'string' } },
                },
                required: ['answer', 'reason', 'sources'],
                additionalProperties: false,
              },
            ])
          ),
          required: ['rookie_card', 'first_team'],
          additionalProperties: false,
        },
        player_facts: {
          type: 'object',
          description: "Facts about the player from the pages you found, for staff who do not follow his league. Leave a value empty if your sources do not give it. Never estimate.",
          properties: {
            season: { type: 'string', description: 'The season the numbers are for, for example 2025-26' },
            stage: { type: 'string', enum: ['prospect', 'established', 'unsure'], description: 'prospect: young and not yet a regular starter at a high level; established: a regular starter' },
            ...Object.fromEntries(['age', 'club', 'league', 'position', 'appearances', 'starts', 'minutes', 'goals', 'assists', 'caps'].map((k) => [k, {
              type: 'object',
              properties: { value: { type: 'string' }, source: { type: 'string' } },
              required: ['value', 'source'],
              additionalProperties: false,
            }])),
          },
          required: ['season', 'stage', 'age', 'club', 'league', 'position', 'appearances', 'starts', 'minutes', 'goals', 'assists', 'caps'],
          additionalProperties: false,
        },
        questions_for_staff: { type: 'array', items: { type: 'string' } },
      },
      required: ['scores', 'checks', 'player_facts', 'questions_for_staff'],
      additionalProperties: false,
    },
  },
];

// The price guide tool is only offered when the server has a SportsCardsPro token.
const toolsFor = (maxSearches) => allTools(maxSearches).filter((t) => t.name !== 'get_price_guide' || priceGuideEnabled());

function systemPrompt(today, maxSearches) {
  return buildInstructions(today, maxSearches);
}

function summarise(text, n = 160) {
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Returns a run row ready to save (never throws).
export async function runAgent(offerId, staffNotes, staffFacts = {}, { maxSearches: searchLimit = MAX_SEARCHES } = {}) {
  let maxSearches = searchLimit;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  const trace = [];
  const sales = [];
  const known = new Set(urlsInText(staffNotes));
  let usage = { input_tokens: 0, output_tokens: 0 };
  let searches = 0;
  let draft = null;
  const base = { offer_id: offerId, model: MODEL, staff_notes: staffNotes };
  let priceGuide = null;
  const finish = (status, error = null) => {
    const summary = summariseSales(sales.map((s) => s.check));
    return {
      ...base, status, error, draft, trace, searches,
      ...(priceGuide ? { price_guide: priceGuide } : {}),
      // price_aud is what the server counted (converted for overseas sales); price/currency are as the AI saw them.
      sales: sales.map(({ input, check }) => ({ ...input, accepted: check.accepted, problems: check.problems, price_aud: check.price, overseas: check.overseas, rate: check.rate })),
      sales_count: summary.sales_count,
      median_sold_aud: summary.median_sold_aud,
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
    };
  };

  if (!process.env.ANTHROPIC_API_KEY) return finish('failed', 'ANTHROPIC_API_KEY is not set on the server.');
  const [{ offer }, { settings }] = await Promise.all([getOffer(offerId), getSettings()]);
  if (!offer || !settings) return finish('failed', 'Offer or owner settings could not be loaded.');
  // Today's exchange rates, only needed if the owner counts overseas sales.
  const rates = settings.count_overseas || priceGuideEnabled() ? effectiveRates(settings, await getAudRates()) : null;
  // The price guide is looked up once by the server, so its result is saved with the run
  // whether or not the agent reads it. Converted like an overseas sale: rate x the owner's adjustment.
  const [guideResult, research] = await Promise.all([
    priceGuideEnabled()
      ? lookupPriceGuide(offer, { rate: rates?.USD ?? null, adjust: Number(settings.overseas_adjust ?? 1) || 1 })
      : Promise.resolve(null),
    getRecentPlayerResearch(offer),
  ]);
  priceGuide = guideResult;
  // The price guide's own page counts as a source the agent may cite.
  if (priceGuide?.link) known.add(normaliseUrl(priceGuide.link));
  // Fewer searches when the server already has the price or today's player research.
  if (priceGuide?.found) maxSearches = Math.min(maxSearches, 2);
  if (research.found) maxSearches = Math.min(maxSearches, 1);
  // Sources from reused research count as seen, so the server does not flag them as unsourced.
  if (research.found) {
    for (const k of ['football', 'career', 'collector']) for (const u of research[k]?.sources ?? []) known.add(normaliseUrl(u));
    for (const u of research.first_team?.sources ?? []) known.add(normaliseUrl(u));
    for (const u of research.rookie_card_same_card?.sources ?? []) known.add(normaliseUrl(u));
  }

  const toolData = {
    get_offer: () => ({
      player: offer.player, year: offer.year, set_name: offer.set_name, card_number: offer.card_number,
      variant: offer.variant, grade_condition_reported: offer.grade_condition, asking_price_aud: Number(offer.asking_price_aud),
      copies_in_stock_staff_count: staffFacts.stock_count ?? 'not given',
      condition_staff_check: staffFacts.condition ?? 'not given',
      rookie_card_staff_check: staffFacts.rookie_card ?? 'not given, check it yourself',
    }),
    get_owner_settings: () => {
      const { id, updated_at, provisional, fx_usd_aud, fx_gbp_aud, fx_eur_aud, ...rest } = settings;
      // The server converts overseas sales itself, so the AI never needs a rate.
      const overseas = settings.count_overseas
        ? { counted: true, conversion: 'Done by the server with today\'s exchange rates and the owner\'s adjustment. Record original prices and do not ask for a rate.', aud_per_unit_today: rates }
        : { counted: false, note: 'Only Australian sales in AUD are counted.' };
      return { ...rest, provisional, overseas };
    },
    get_price_guide: () => priceGuide
      ? { label: 'SportsCardsPro price guide: an estimated value, not a sale', ...priceGuide }
      : { found: false, reason: 'Price guide not switched on.' },
    get_recent_player_research: () => research.found
      ? { label: 'Player research from another assessment in the last 24 hours', ...research }
      : { found: false, note: 'No research on this player in the last 24 hours.' },
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = [{
    role: 'user',
    content: `Prepare the evidence draft for this offer.\n\nStaff notes (may include sold listing links staff found):\n${staffNotes || '(none)'}`,
  }];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const resp = await client.messages.create({
        model: MODEL, max_tokens: 3000, system: systemPrompt(today, maxSearches), tools: toolsFor(maxSearches), messages,
      });
      usage.input_tokens += resp.usage?.input_tokens ?? 0;
      usage.output_tokens += resp.usage?.output_tokens ?? 0;
      messages.push({ role: 'assistant', content: resp.content });

      const results = [];
      for (const block of resp.content) {
        if (block.type === 'server_tool_use' && block.name === 'web_search') {
          searches += 1;
          trace.push({ type: 'search', query: summarise(block.input?.query ?? '', 200) });
        } else if (block.type === 'web_search_tool_result') {
          const items = Array.isArray(block.content) ? block.content : [];
          for (const r of items) if (r.url) known.add(normaliseUrl(r.url));
          trace.push({
            type: 'search_results',
            results: Array.isArray(block.content)
              ? items.slice(0, 8).map((r) => ({ title: summarise(r.title ?? '', 100), url: r.url }))
              : [{ error: block.content?.error_code ?? 'error' }],
          });
        } else if (block.type === 'tool_use') {
          let out;
          if (toolData[block.name]) {
            out = toolData[block.name]();
            trace.push({ type: 'tool', name: block.name });
          } else if (block.name === 'record_sale') {
            const check = checkSale(block.input, known, today, settings.sales_window_days, overseasRule(settings, rates));
            sales.push({ input: block.input, check });
            out = check.accepted ? { recorded: true } : { recorded: false, problems: check.problems };
            trace.push({ type: 'tool', name: 'record_sale', url: block.input?.url, accepted: check.accepted, problems: check.problems });
          } else if (block.name === 'submit_draft') {
            draft = checkDraft(block.input, known);
            trace.push({ type: 'tool', name: 'submit_draft' });
            out = { received: true };
          } else {
            out = { error: 'Unknown tool' };
          }
          results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
        }
      }

      if (draft) return finish('completed');
      if (resp.stop_reason === 'pause_turn') continue;
      const nudge = { type: 'text', text: 'Call submit_draft now with your best draft and questions for staff.' };
      if (results.length) {
        // Every tool call must get a result before anything else is sent.
        messages.push({ role: 'user', content: resp.stop_reason === 'tool_use' ? results : [...results, nudge] });
      } else {
        messages.push({ role: 'user', content: [nudge] });
      }
    }
    return finish('failed', 'The agent did not submit a draft within the step limit.');
  } catch (e) {
    console.error('runAgent failed:', e);
    return finish('failed', 'The AI service returned an error. Try again later.');
  }
}
