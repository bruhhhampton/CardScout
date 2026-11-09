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
// auto = true when CardScout prepared it straight after an AI draft: saved as "not confirmed"
// until a person confirms it. A person submitting the form is confirmed straight away.
export async function createAssessment(offerId, input, result, settings, agentRunId = null, { auto = false } = {}) {
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
    // score_football is the combined football quality (80% real-world + 20% FM role fit).
    score_football: Math.round(result.football ?? input.scores.football),
    football_real: result.football_real ?? input.scores.football,
    fm_fit: result.fm_fit ?? null,
    fm_role: result.fm_role ?? null,
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
    // The owner's decision this verdict learned from, if any (database/017).
    ...(result.learned_from ? { learned_from: result.learned_from } : {}),
    prepared_by: auto ? 'cardscout' : 'staff',
    confirmed: !auto,
    ...(auto ? {} : { confirmed_at: new Date().toISOString() }),
  };
  let { error } = await supabase.from('assessments').insert(row);
  if (error && `${error.message} ${error.details ?? ''}`.includes('learned_from')) {
    console.error('assessments.learned_from missing; run database/017. Saving without it.');
    delete row.learned_from;
    ({ error } = await supabase.from('assessments').insert(row));
  }
  // Safety net: if a newer database script has not been run yet, save without its columns.
  // The outcome and reasons are already worked out, so the verdict is the same.
  const NEWER = ['football_real', 'fm_fit', 'fm_role', 'rookie_card', 'first_team', 'prepared_by', 'confirmed', 'confirmed_at'];
  for (let tries = 0; error && tries < 3; tries++) {
    const text = `${error.message} ${error.details ?? ''}`;
    const missing = NEWER.filter((c) => text.includes(c));
    if (!missing.length) break;
    console.error(`Columns missing (${missing.join(', ')}); run the newest database scripts. Saving without them.`);
    const FM = ['football_real', 'fm_fit', 'fm_role'];
    const CONFIRM = ['prepared_by', 'confirmed', 'confirmed_at'];
    const drop = missing.some((c) => CONFIRM.includes(c)) ? CONFIRM : missing.some((c) => FM.includes(c)) ? FM : ['rookie_card', 'first_team'];
    for (const c of drop) delete row[c];
    ({ error } = await supabase.from('assessments').insert(row));
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

// A person confirms an assessment CardScout prepared. Returns { error }.
export async function confirmAssessment(assessmentId, offerId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  const { error } = await supabase
    .from('assessments')
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('offer_id', offerId);
  if (error) {
    console.error('confirmAssessment failed:', error);
    return { error: 'The confirmation was not saved. Run database/007_confirm.sql in Supabase, then try again.' };
  }
  return { error: null };
}
