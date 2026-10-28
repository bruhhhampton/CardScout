'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOffer, OFFER_ID_PATTERN, setOfferPlayer } from '@/lib/offers';
import { getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';

import { getSettings } from '@/lib/settings';
import { confirmAssessment, createAssessment } from '@/lib/assessments';
import { validateAssessment } from '@/lib/assessment-fields';
import { assess, OUTCOMES } from '@/lib/assess.mjs';
import { fmFit } from '@/lib/fm-fit.mjs';
import { buildSalesNote } from '@/lib/sales-note.mjs';
import { runAgent } from '@/lib/agent';
import { countRunsLastDay, saveRun } from '@/lib/agent-runs';
import { cookies } from 'next/headers';
import { AGENT_COOKIE, agentToken, cookieOptions, isRemembered, passcodeOk } from '@/lib/agent-access';

function field(formData, name) {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

// Staff confirm which FM player an offer refers to. The server checks both ids.
export async function linkPlayer(formData) {
  const offerId = field(formData, 'offer_id');
  const playerId = field(formData, 'player_id');
  if (!OFFER_ID_PATTERN.test(offerId)) redirect('/');
  if (!PLAYER_ID_PATTERN.test(playerId)) redirect(`/offers/${offerId}?msg=bad-player`);
  const { player } = await getPlayer(playerId);
  if (!player) redirect(`/offers/${offerId}?msg=bad-player`);
  const { error } = await setOfferPlayer(offerId, playerId);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}?msg=${error ? 'save-failed' : 'linked'}`);
}

export async function unlinkPlayer(formData) {
  const offerId = field(formData, 'offer_id');
  if (!OFFER_ID_PATTERN.test(offerId)) redirect('/');
  const { error } = await setOfferPlayer(offerId, null);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}?msg=${error ? 'save-failed' : 'unlinked'}`);
}


const ASSESS_FIELDS = [
  'stock_count', 'condition', 'rookie_card', 'first_team', 'sales_count', 'median_sold_aud', 'evidence_source',
  'score_football', 'score_career', 'score_collector', 'score_card', 'score_valuation',
];

// Runs the owner's rules (plain code) on what staff entered, then saves the result.
export async function assessOffer(_prev, formData) {
  const offerId = field(formData, 'offer_id');
  const values = {};
  for (const k of ASSESS_FIELDS) values[k] = typeof formData.get(k) === 'string' ? formData.get(k) : '';
  const attempt = Date.now();
  const fail = (message, errors = {}) => ({ status: 'error', message, errors, values, attempt });
  if (!OFFER_ID_PATTERN.test(offerId)) return fail('This offer could not be found.');
  const check = validateAssessment(values);
  if (!check.ok) return fail('Please fix the highlighted fields.', check.errors);
  const [{ offer }, { settings, error: sErr }] = await Promise.all([getOffer(offerId), getSettings()]);
  if (!offer) return fail('This offer could not be found.');
  if (sErr) return fail(sErr);
  // Cerf's FM role fit (20% of football quality), worked out in plain code from the linked player.
  const fit = offer.player_id ? fmFit((await getPlayer(offer.player_id)).player) : null;
  const result = assess(offer, { ...check.input, fm_fit: fit?.score ?? null, fm_role: fit?.role ?? null }, settings);
  const runId = field(formData, 'agent_run_id');
  const agentRunId = OFFER_ID_PATTERN.test(runId) ? runId : null;
  const { error } = await createAssessment(offerId, check.input, result, settings, agentRunId);
  if (error) return fail(error);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  return { status: 'success', message: 'Assessment saved.', errors: {}, values, attempt };
}


const DAILY_LIMIT = Number(process.env.AGENT_DAILY_LIMIT || 30);


// One click: the bounded AI agent prepares the draft, then the owner's plain-code rules work out
// the verdict from it, using the stock and condition staff entered. The verdict is saved as
// "not confirmed" until a person confirms it. Nothing is bought.
export async function prepareDraft(_prev, formData) {
  const offerId = field(formData, 'offer_id');
  const extra = (typeof formData.get('staff_notes') === 'string' ? formData.get('staff_notes') : '').slice(0, 1000);
  const paste = {
    link: field(formData, 'sales_link').slice(0, 500),
    currency: field(formData, 'sales_currency'),
    rows: (typeof formData.get('sales_rows') === 'string' ? formData.get('sales_rows') : '').slice(0, 3000),
  };
  const values = {
    stock_count: field(formData, 'stock_count'), condition: field(formData, 'condition'),
    sales_link: paste.link, sales_currency: paste.currency, sales_rows: paste.rows,
  };
  const attempt = Date.now();
  let notes = extra;
  const fail = (message, errors = {}) => ({ status: 'error', message, errors, notes: extra, values, attempt });
  if (!OFFER_ID_PATTERN.test(offerId)) return fail('This offer could not be found.');
  if (paste.rows.trim() && !/^https?:\/\//i.test(paste.link)) {
    return fail('Please fix the highlighted fields.', { sales_link: 'Paste the address of the page the sales came from.' });
  }
  if (paste.rows.trim()) {
    // CardScout writes the explanation for the AI; staff only pasted the link, currency and rows.
    const { offer: o } = await getOffer(offerId);
    notes = [buildSalesNote(o, paste), extra && `Other notes from staff: ${extra}`].filter(Boolean).join('\n\n');
  }

  // Check what only a person can know before spending an AI run.
  const errors = {};
  if (!/^\d+$/.test(values.stock_count) || Number(values.stock_count) > 1000) errors.stock_count = 'Enter the number of copies in stock (0 if none).';
  if (!['acceptable', 'not_acceptable', 'unsure'].includes(values.condition)) errors.condition = 'Choose a condition.';
  if (Object.keys(errors).length) return fail('Please fix the highlighted fields.', errors);

  if (!process.env.AGENT_PASSCODE) return fail('AI drafts are locked: AGENT_PASSCODE is not set on the server.');
  const jar = await cookies();
  if (!isRemembered(jar)) {
    if (!passcodeOk(formData.get('passcode'))) return fail('Wrong passcode. Nothing was run.');
    // Remember the passcode on this device only if staff ticked the box.
    if (formData.get('remember') === 'on') jar.set(AGENT_COOKIE, agentToken(), cookieOptions());
  }
  if (!process.env.ANTHROPIC_API_KEY) return fail('AI drafts are not set up yet: ANTHROPIC_API_KEY is missing on the server.');
  if ((await countRunsLastDay()) >= DAILY_LIMIT) {
    return fail(`The daily limit of ${DAILY_LIMIT} AI drafts has been reached. Try again tomorrow or enter the evidence by hand.`);
  }

  const run = await runAgent(offerId, notes, {
    stock_count: Number(values.stock_count),
    condition: { acceptable: 'meets the standard', not_acceptable: 'below the standard', unsure: 'unsure' }[values.condition],
  });
  const { id: runId, error } = await saveRun(run);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  if (error) return fail(error);
  if (run.status !== 'completed') return fail(`The AI draft did not finish: ${run.error}`);

  // Work out the verdict from the draft, in plain code.
  const scores = Object.fromEntries(['football', 'career', 'collector', 'card', 'valuation'].map((k) => [k, run.draft?.scores?.[k]?.score]));
  const missing = Object.entries(scores).filter(([, v]) => !Number.isInteger(v)).map(([k]) => k);
  const done = (message) => ({ status: 'success', message, errors: {}, notes: '', values: { stock_count: values.stock_count, condition: values.condition }, attempt });
  if (missing.length) {
    return done(`AI draft ready, but it has no ${missing.join(', ')} score, so the verdict was not worked out. Fill it in under Assessment and run it.`);
  }
  const [{ offer }, { settings, error: sErr }] = await Promise.all([getOffer(offerId), getSettings()]);
  if (!offer || sErr) return done('AI draft ready, but the owner settings could not be loaded, so the verdict was not worked out. Run the assessment below.');
  const answer = (k) => (['yes', 'no', 'unsure'].includes(run.draft?.checks?.[k]?.answer) ? run.draft.checks[k].answer : 'unsure');
  const accepted = (run.sales ?? []).filter((x) => x.accepted);
  const input = {
    stock_count: Number(values.stock_count),
    condition: values.condition,
    rookie_card: answer('rookie_card'),
    first_team: answer('first_team'),
    sales_count: run.sales_count ?? 0,
    median_sold_aud: run.median_sold_aud ?? null,
    evidence_source: `AI draft ${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}${accepted.some((x) => x.overseas) ? ` (${accepted.filter((x) => !x.overseas).length} Australian, ${accepted.filter((x) => x.overseas).length} overseas, converted)` : ''}: ${[...new Set(accepted.map((x) => x.url))].join(' ')}`.slice(0, 500),
    scores,
  };
  const fit = offer.player_id ? fmFit((await getPlayer(offer.player_id)).player) : null;
  const result = assess(offer, { ...input, fm_fit: fit?.score ?? null, fm_role: fit?.role ?? null }, settings);
  const { error: aErr } = await createAssessment(offerId, input, result, settings, runId, { auto: true });
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  if (aErr) return done(`AI draft ready, but the verdict could not be saved (${aErr}). Run the assessment below.`);
  return done(`Draft and verdict ready: ${OUTCOMES[result.outcome]}. Check the evidence, then confirm it or change something.`);
}

// A person confirms the verdict CardScout prepared.
export async function confirmVerdict(formData) {
  const offerId = field(formData, 'offer_id');
  const assessmentId = field(formData, 'assessment_id');
  if (!OFFER_ID_PATTERN.test(offerId) || !OFFER_ID_PATTERN.test(assessmentId)) redirect('/');
  const { error } = await confirmAssessment(assessmentId, offerId);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}?msg=${error ? 'confirm-failed' : 'confirmed'}`);
}

// Removes the remembered passcode from this device.
export async function forgetPasscode(formData) {
  const offerId = field(formData, 'offer_id');
  (await cookies()).delete(AGENT_COOKIE);
  redirect(OFFER_ID_PATTERN.test(offerId) ? `/offers/${offerId}` : '/');
}
