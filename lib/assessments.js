import 'server-only';
import { getSupabase } from './supabase-server';

export async function getLatestAssessment(offerId) {
  const supabase = getSupabase();
  if (!supabase) return { assessment: null, error: null };
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('getLatestAssessment failed:', error);
    return { assessment: null, error: 'Could not load the latest assessment.' };
  }
  return { assessment: data?.[0] ?? null, error: null };
}

// Saves the assessment and updates the offer's status. Returns { error }.
export async function createAssessment(offerId, input, result, settings, agentRunId = null) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  const row = {
    offer_id: offerId,
    stock_count: input.stock_count,
    condition: input.condition,
    rookie_card: input.rookie_card,
    first_team: input.first_team,
    sales_count: input.sales_count,
    median_sold_aud: input.median_sold_aud,
    evidence_source: input.evidence_source,
    score_football: input.scores.football,
    score_career: input.scores.career,
    score_collector: input.scores.collector,
    score_card: input.scores.card,
    score_valuation: input.scores.valuation,
    cerf_total: result.cerf_total,
    cerf_category: result.cerf_category,
    offer_ceiling_aud: result.offer_ceiling_aud,
    outcome: result.outcome,
    reasons: result.reasons,
    settings_snapshot: settings,
    ...(agentRunId ? { agent_run_id: agentRunId } : {}),
  };
  let { error } = await supabase.from('assessments').insert(row);
  // Safety net: if database/005_gates.sql has not been run yet, save without the two gate
  // columns. The outcome and its reasons already include the gate answers.
  if (error && /rookie_card|first_team/.test(`${error.message} ${error.details ?? ''}`)) {
    console.error('Gate columns missing; run database/005_gates.sql. Saving without them.');
    const { rookie_card, first_team, ...rest } = row;
    ({ error } = await supabase.from('assessments').insert(rest));
  }
  if (error) {
    console.error('createAssessment failed:', error);
    return { error: 'The assessment was not saved. Check the values and try again.' };
  }
  const status = result.outcome === 'owner_review' ? 'owner_review' : 'assessed';
  const { error: e2 } = await supabase
    .from('card_offers')
    .update({ last_outcome: result.outcome, status })
    .eq('id', offerId);
  if (e2) {
    console.error('update offer outcome failed:', e2);
    return { error: 'The assessment was saved but the offer status did not update. Refresh and check.' };
  }
  return { error: null };
}
