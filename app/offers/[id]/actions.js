'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOffer, OFFER_ID_PATTERN, setOfferPlayer } from '@/lib/offers';
import { getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';

import { getSettings } from '@/lib/settings';
import { createAssessment } from '@/lib/assessments';
import { validateAssessment } from '@/lib/assessment-fields';
import { assess } from '@/lib/assess.mjs';
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
  // If the passcode is remembered on this device, start the AI draft straight after linking.
  const startDraft = !error && field(formData, 'then') === 'draft' && isRemembered(await cookies());
  redirect(`/offers/${offerId}?msg=${error ? 'save-failed' : 'linked'}${startDraft ? '&draft=1' : ''}`);
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
  const result = assess(offer, check.input, settings);
  const runId = field(formData, 'agent_run_id');
  const agentRunId = OFFER_ID_PATTERN.test(runId) ? runId : null;
  const { error } = await createAssessment(offerId, check.input, result, settings, agentRunId);
  if (error) return fail(error);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  return { status: 'success', message: 'Assessment saved.', errors: {}, values, attempt };
}


const DAILY_LIMIT = Number(process.env.AGENT_DAILY_LIMIT || 30);


// Runs the bounded AI agent to prepare a draft. Staff still review and run the assessment.
export async function prepareDraft(_prev, formData) {
  const offerId = field(formData, 'offer_id');
  const notes = (typeof formData.get('staff_notes') === 'string' ? formData.get('staff_notes') : '').slice(0, 4000);
  const attempt = Date.now();
  if (!OFFER_ID_PATTERN.test(offerId)) return { status: 'error', message: 'This offer could not be found.', notes, attempt };
  if (!process.env.AGENT_PASSCODE) {
    return { status: 'error', message: 'AI drafts are locked: AGENT_PASSCODE is not set on the server.', notes, attempt };
  }
  const jar = await cookies();
  if (!isRemembered(jar)) {
    if (!passcodeOk(formData.get('passcode'))) {
      return { status: 'error', message: 'Wrong passcode. Nothing was run.', notes, attempt };
    }
    // Remember the passcode on this device only if staff ticked the box.
    if (formData.get('remember') === 'on') jar.set(AGENT_COOKIE, agentToken(), cookieOptions());
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: 'error', message: 'AI drafts are not set up yet: ANTHROPIC_API_KEY is missing on the server.', notes, attempt };
  }
  if ((await countRunsLastDay()) >= DAILY_LIMIT) {
    return { status: 'error', message: `The daily limit of ${DAILY_LIMIT} AI drafts has been reached. Try again tomorrow or enter the evidence by hand.`, notes, attempt };
  }
  const run = await runAgent(offerId, notes);
  const { error } = await saveRun(run);
  revalidatePath(`/offers/${offerId}`);
  if (error) return { status: 'error', message: error, notes, attempt };
  if (run.status !== 'completed') return { status: 'error', message: `The AI draft did not finish: ${run.error}`, notes, attempt };
  return { status: 'success', message: 'AI draft ready. Check every score and link below before running the assessment.', notes: '', attempt };
}

// Removes the remembered passcode from this device.
export async function forgetPasscode(formData) {
  const offerId = field(formData, 'offer_id');
  (await cookies()).delete(AGENT_COOKIE);
  redirect(OFFER_ID_PATTERN.test(offerId) ? `/offers/${offerId}` : '/');
}
