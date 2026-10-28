import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getOffer } from './offers';
import { getSettings } from './settings';
import { getPlayer } from './players';
import { buildInstructions } from './agent-instructions.mjs';
import { checkDraft, checkSale, normaliseUrl, summariseSales, urlsInText, overseasRule } from './agent-checks.mjs';

// Bounded AI agent. It gathers evidence and drafts CERF scores with sources.
// It cannot decide outcomes, change rules, count sales, calculate prices or buy anything.
// The plain-code rules in lib/assess.mjs still make the decision after staff review.

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_SEARCHES = 5;
const MAX_STEPS = 10;

const TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES },
  {
    name: 'get_offer',
    description: 'Read the card offer being assessed: player, year, set, card number, variant, grade or condition as reported, asking price in AUD.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_owner_settings',
    description: "Read the owner's buying settings: limits, evidence needed (minimum sold sales and window in days) and CERF weights and thresholds.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_fm_player',
    description: 'Read the Football Manager 26 ratings for the player linked to this offer, if staff linked one. Unverified game data: context only, never price evidence.',
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
    description: "Finish by submitting draft CERF scores (0 to 100) with a short reason and source links for each, Cerf's two checks with reasons and sources, plus questions staff must answer. Call this exactly once, last.",
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
          description: "Cerf's two checks: rookie_card (recognised rookie card?) and first_team (first-team chance?).",
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
        questions_for_staff: { type: 'array', items: { type: 'string' } },
      },
      required: ['scores', 'checks', 'questions_for_staff'],
      additionalProperties: false,
    },
  },
];

function systemPrompt(today) {
  return buildInstructions(today, MAX_SEARCHES);
}

function summarise(text, n = 160) {
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Returns a run row ready to save (never throws).
export async function runAgent(offerId, staffNotes) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  const trace = [];
  const sales = [];
  const known = new Set(urlsInText(staffNotes));
  let usage = { input_tokens: 0, output_tokens: 0 };
  let searches = 0;
  let draft = null;
  const base = { offer_id: offerId, model: MODEL, staff_notes: staffNotes };
  const finish = (status, error = null) => {
    const summary = summariseSales(sales.map((s) => s.check));
    return {
      ...base, status, error, draft, trace, searches,
      // price_aud is what the server counted (converted for overseas sales); price/currency are as the AI saw them.
      sales: sales.map(({ input, check }) => ({ ...input, accepted: check.accepted, problems: check.problems, price_aud: check.price, overseas: check.overseas })),
      sales_count: summary.sales_count,
      median_sold_aud: summary.median_sold_aud,
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
    };
  };

  if (!process.env.ANTHROPIC_API_KEY) return finish('failed', 'ANTHROPIC_API_KEY is not set on the server.');
  const [{ offer }, { settings }] = await Promise.all([getOffer(offerId), getSettings()]);
  if (!offer || !settings) return finish('failed', 'Offer or owner settings could not be loaded.');
  const { player } = offer.player_id ? await getPlayer(offer.player_id) : { player: null };

  const toolData = {
    get_offer: () => ({
      player: offer.player, year: offer.year, set_name: offer.set_name, card_number: offer.card_number,
      variant: offer.variant, grade_condition_reported: offer.grade_condition, asking_price_aud: Number(offer.asking_price_aud),
    }),
    get_owner_settings: () => {
      const { id, updated_at, provisional, ...rest } = settings;
      return { ...rest, provisional };
    },
    get_fm_player: () =>
      player ? { label: 'Football Manager 26 game ratings, unverified, context only', ...player } : { linked: false, note: 'No FM player linked by staff.' },
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = [{
    role: 'user',
    content: `Prepare the evidence draft for this offer.\n\nStaff notes (may include sold listing links staff found):\n${staffNotes || '(none)'}`,
  }];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const resp = await client.messages.create({
        model: MODEL, max_tokens: 3000, system: systemPrompt(today), tools: TOOLS, messages,
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
            const check = checkSale(block.input, known, today, settings.sales_window_days, overseasRule(settings));
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
