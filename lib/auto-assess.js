import 'server-only';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getOffer } from '@/lib/offers';
import { getSettings } from '@/lib/settings';
import { createAssessment } from '@/lib/assessments';
import { assess, OUTCOMES } from '@/lib/assess.mjs';
import { MODEL, runAgent } from '@/lib/agent';
import { countRunsLastDay, finishRun, startRun } from '@/lib/agent-runs';
import { isRemembered } from '@/lib/agent-access';

export const DAILY_LIMIT = Number(process.env.AGENT_DAILY_LIMIT || 30);

// Staff answers used when an assessment starts on its own: none in stock, condition meets the standard,
// rookie status checked by the AI. Staff can change these and run it again.
export const DEFAULT_VALUES = { stock_count: '0', condition: 'acceptable', rookie_card: '' };
const DEFAULT_FACTS = { stock_count: 0, condition: 'meets the standard', rookie_card: null };

// Saves a "running" row, then runs the agent and the owner's rules after the response is sent.
// Returns { id } when it started, { unsupported: true } before database/010 is run, or { error }.
export async function startInBackground(offerId, notes, facts, values, options = {}) {
  const started = await startRun({ offer_id: offerId, model: MODEL, staff_notes: notes });
  if (!started.id) return started;
  after(async () => {
    const run = await runAgent(offerId, notes, facts, options);
    // Save the verdict first, then mark the run finished. The other way round, a page refresh in the
    // gap saw a finished run with no verdict and showed the Assess button again.
    if (run.status === 'completed') {
      try { await verdictFromRun(offerId, run, started.id, values); } catch (e) { console.error('Verdict failed:', e?.message); }
    }
    await finishRun(started.id, run);
  });
  return started;
}

// Starts the assessment as soon as an offer is saved, so staff do not have to click anything.
// Only on a device that has remembered the team passcode, and only when the AI is set up and
// under its daily limit. Returns true when it started.
export async function autoStart(offerId, cookieStore) {
  if (!process.env.AGENT_PASSCODE || !process.env.ANTHROPIC_API_KEY) return false;
  if (!isRemembered(cookieStore)) return false;
  if ((await countRunsLastDay()) >= DAILY_LIMIT) return false;
  const started = await startInBackground(offerId, '', DEFAULT_FACTS, DEFAULT_VALUES);
  return Boolean(started.id);
}

// Works out the verdict from a finished draft, in plain code, and saves it as "not confirmed".
// Returns a message for staff.
export async function verdictFromRun(offerId, run, runId, values) {
  const scores = Object.fromEntries(['football', 'career', 'collector', 'card', 'valuation'].map((k) => [k, run.draft?.scores?.[k]?.score]));
  const missing = Object.entries(scores).filter(([, v]) => !Number.isInteger(v)).map(([k]) => k);
  if (missing.length) {
    return `AI draft ready, but it has no ${missing.join(', ')} score, so the verdict was not worked out. Fill it in under Assessment and run it.`;
  }
  const [{ offer }, { settings, error: sErr }] = await Promise.all([getOffer(offerId), getSettings()]);
  if (!offer || sErr) return 'AI draft ready, but the owner settings could not be loaded, so the verdict was not worked out. Run the assessment below.';
  const answer = (k) => (['yes', 'no', 'unsure'].includes(run.draft?.checks?.[k]?.answer) ? run.draft.checks[k].answer : 'unsure');
  const accepted = (run.sales ?? []).filter((x) => x.accepted);
  const input = {
    stock_count: Number(values.stock_count),
    condition: values.condition,
    // Staff answer from the card itself wins over the AI's web check.
    rookie_card: values.rookie_card || answer('rookie_card'),
    first_team: answer('first_team'),
    sales_count: run.sales_count ?? 0,
    median_sold_aud: run.median_sold_aud ?? null,
    price_guide_aud: run.price_guide?.found ? run.price_guide.value_aud : null,
    evidence_source: `AI draft ${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}${accepted.some((x) => x.overseas) ? ` (${accepted.filter((x) => !x.overseas).length} Australian, ${accepted.filter((x) => x.overseas).length} overseas, converted)` : ''}: ${[...new Set(accepted.map((x) => x.url))].join(' ')}`.slice(0, 500),
    scores,
  };
  // Football quality is real-world evidence only (Football Manager ratings were removed on 5 Nov 2026).
  const result = assess(offer, input, settings);
  if (result.price_basis === 'price_guide') {
    input.evidence_source = `${input.evidence_source} | Market value from the SportsCardsPro price guide: ${run.price_guide.name}, ${run.price_guide.grade}`.slice(0, 500);
  }
  const { error: aErr } = await createAssessment(offerId, input, result, settings, runId, { auto: true });
  try {
    revalidatePath('/');
    revalidatePath(`/offers/${offerId}`);
  } catch { /* after the response the page refreshes itself */ }
  if (aErr) return `AI draft ready, but the verdict could not be saved (${aErr}). Run the assessment below.`;
  return `Draft and verdict ready: ${OUTCOMES[result.outcome]}. Check the evidence, then confirm it or change something.`;
}

