import 'server-only';
import { getSupabase } from './supabase-server';
import { applyLearned, learnedRuleFor, sameCard } from './owner-decisions.mjs';

const NOT_CONNECTED = 'The server is not connected to the database.';
const BASE = 'id, created_at, offer_id, assessment_id, decision, offer_aud, reason, suggested, player, year, set_name, variant, asking_price_aud';
// Added by database/017. Until it is run, decisions load and save without them.
const LEARN = ['learn', 'forgotten_at', 'rules_hit'];
const text = (error) => `${error?.message} ${error?.details ?? ''}`;
const missingTable = (error) => /owner_decision/.test(text(error));
const missingLearn = (error) => LEARN.some((c) => text(error).includes(c));
export const SETUP_MESSAGE = 'Run database/016_owner_decisions.sql in Supabase first.';
export const LEARN_SETUP_MESSAGE = 'Run database/017_learned_rules.sql in Supabase first.';

// Saves the owner's decision next to CardScout's suggestion. Nothing is bought.
export async function saveOwnerDecision(offer, assessment, input, rulesHit = []) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const row = {
    offer_id: offer.id,
    assessment_id: assessment?.id ?? null,
    decision: input.decision,
    offer_aud: input.offer_aud,
    reason: input.reason,
    suggested: assessment?.outcome ?? null,
    player: offer.player ?? '',
    year: offer.year ?? null,
    set_name: offer.set_name ?? '',
    variant: offer.variant ?? '',
    asking_price_aud: offer.asking_price_aud ?? null,
    learn: input.learn !== false,
    rules_hit: rulesHit,
  };
  const insert = (r) => supabase.from('owner_decisions').insert(r).select(BASE).single();
  let { data, error } = await insert(row);
  if (error && missingLearn(error)) {
    console.error('owner_decisions learning columns missing; run database/017. Saving without them.');
    for (const c of LEARN) delete row[c];
    ({ data, error } = await insert(row));
  }
  if (error) {
    console.error('saveOwnerDecision failed:', error);
    return { error: missingTable(error) ? SETUP_MESSAGE : 'The decision was not saved. Try again.' };
  }
  const { error: e2 } = await supabase.from('card_offers').update({ owner_decision: input.decision }).eq('id', offer.id);
  if (e2) console.error('owner_decision on offer failed:', e2);
  return { error: null, saved: { ...row, ...data } };
}

// The owner's latest decision on one card, or null.
export async function getOwnerDecision(offerId) {
  const supabase = getSupabase();
  if (!supabase) return { decision: null };
  const { data, error } = await supabase.from('owner_decisions').select(BASE)
    .eq('offer_id', offerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return { decision: null, missing: missingTable(error) };
  return { decision: data ?? null };
}

// Recent decisions, newest first, for matching, learning and the Owner tab.
// Empty until database/016 is run; without database/017 every decision counts as learned.
export async function listOwnerDecisions(limit = 300) {
  const supabase = getSupabase();
  if (!supabase) return { decisions: [] };
  const list = (cols) => supabase.from('owner_decisions').select(cols).order('created_at', { ascending: false }).limit(limit);
  let { data, error } = await list(`${BASE}, ${LEARN.join(', ')}`);
  let learning = true;
  if (error && missingLearn(error)) { learning = false; ({ data, error } = await list(BASE)); }
  if (error) return { decisions: [], missing: missingTable(error), learning };
  return { decisions: data ?? [], learning };
}

// The learned rule for this card, or null.
export async function learnedRuleForOffer(offer) {
  const { decisions } = await listOwnerDecisions();
  return learnedRuleFor(offer, decisions);
}

// The owner removes a learned rule in Settings: every decision on that same card stops applying.
export async function forgetLearned(decisionId) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { decisions, learning } = await listOwnerDecisions(1000);
  if (!learning) return { error: LEARN_SETUP_MESSAGE };
  const rule = decisions.find((d) => d.id === decisionId);
  if (!rule) return { error: 'That learned rule could not be found.' };
  const ids = decisions.filter((d) => sameCard(rule, d)).map((d) => d.id);
  const { error } = await supabase.from('owner_decisions').update({ forgotten_at: new Date().toISOString() }).in('id', ids);
  if (error) {
    console.error('forgetLearned failed:', error);
    return { error: 'Not removed. Try again.' };
  }
  return { error: null };
}

// After the owner decides, other cards still waiting for him that are the same card are worked out
// again with what he just decided. Only their saved verdict changes (as "not confirmed"); no AI is run.
// Returns how many cards changed.
export async function applyToWaiting(rule, settings) {
  const supabase = getSupabase();
  if (!supabase || !rule || rule.learn === false) return 0;
  const { data: offers, error } = await supabase.from('card_offers')
    .select('id, player, year, set_name, variant, asking_price_aud, owner_decision, last_outcome')
    .eq('last_outcome', 'owner_review');
  if (error) return 0;
  let changed = 0;
  for (const offer of offers ?? []) {
    if (offer.id === rule.offer_id || offer.owner_decision || offer.last_outcome !== 'owner_review' || !sameCard(offer, rule)) continue;
    const { data: rows } = await supabase.from('assessments').select('*').eq('offer_id', offer.id)
      .order('created_at', { ascending: false }).limit(1);
    const last = rows?.[0];
    if (!last) continue;
    const next = applyLearned({ outcome: last.outcome, reasons: last.reasons ?? [], offer_ceiling_aud: last.offer_ceiling_aud }, offer, last, settings, rule);
    if (next.outcome === last.outcome) continue;
    const { id, created_at, confirmed_at, ...copy } = last;
    const row = { ...copy, outcome: next.outcome, reasons: next.reasons, offer_ceiling_aud: next.offer_ceiling_aud,
      learned_from: rule.id, prepared_by: 'cardscout', confirmed: false };
    let { error: e1 } = await supabase.from('assessments').insert(row);
    if (e1 && text(e1).includes('learned_from')) { delete row.learned_from; ({ error: e1 } = await supabase.from('assessments').insert(row)); }
    if (e1) { console.error('applyToWaiting failed:', e1); continue; }
    await supabase.from('card_offers').update({ last_outcome: next.outcome, status: 'assessed' }).eq('id', offer.id);
    changed += 1;
  }
  return changed;
}
