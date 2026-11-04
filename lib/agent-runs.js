import 'server-only';
import { getSupabase } from './supabase-server';

export async function getLatestRun(offerId) {
  const supabase = getSupabase();
  if (!supabase) return { run: null };
  const { data, error } = await supabase
    .from('agent_runs').select('*').eq('offer_id', offerId)
    .order('created_at', { ascending: false }).limit(1);
  if (error) {
    console.error('getLatestRun failed:', error);
    return { run: null };
  }
  return { run: data?.[0] ?? null };
}

export async function countRunsLastDay() {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count, error } = await supabase
    .from('agent_runs').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (error) {
    console.error('countRunsLastDay failed:', error);
    return Infinity; // fail closed: no runs if we cannot check the cap
  }
  return count ?? 0;
}

export async function saveRun(row) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  let { data, error } = await supabase.from('agent_runs').insert(row).select('id').single();
  if (error && /price_guide/.test(`${error.message} ${error.details ?? ''}`)) {
    // database/011_price_guide.sql not run yet: save the run without the price guide.
    const { price_guide, ...rest } = row;
    ({ data, error } = await supabase.from('agent_runs').insert(rest).select('id').single());
  }
  if (error) {
    console.error('saveRun failed:', error);
    return { id: null, error: 'The AI draft ran but could not be saved.' };
  }
  return { id: data?.id ?? null, error: null };
}

// How long a run may stay "running" before the page treats it as stopped.
export const RUN_TIMEOUT_MS = 4 * 60 * 1000;
export function isRunning(run) {
  return run?.status === 'running' && Date.now() - new Date(run.created_at).getTime() < RUN_TIMEOUT_MS;
}

// Saves a "running" row so staff can leave the page while the AI works.
// Returns { id } or { unsupported: true } if database/010_background_runs.sql has not been run yet.
export async function startRun(row) {
  const supabase = getSupabase();
  if (!supabase) return { id: null, error: 'The server is not connected to the database.' };
  const { data, error } = await supabase.from('agent_runs').insert({ ...row, status: 'running' }).select('id').single();
  if (error) {
    if (error.code === '23514' || /status_check/.test(error.message ?? '')) return { id: null, unsupported: true };
    console.error('startRun failed:', error);
    return { id: null, error: 'The AI draft could not be started. Try again.' };
  }
  return { id: data?.id ?? null, error: null };
}

// Replaces the "running" row with the finished run.
export async function finishRun(id, run) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  const { offer_id, ...rest } = run;
  let { error } = await supabase.from('agent_runs').update(rest).eq('id', id);
  if (error && /price_guide/.test(`${error.message} ${error.details ?? ''}`)) {
    const { price_guide, ...withoutGuide } = rest;
    ({ error } = await supabase.from('agent_runs').update(withoutGuide).eq('id', id));
  }
  if (error) {
    console.error('finishRun failed:', error);
    return { error: 'The AI draft ran but could not be saved.' };
  }
  return { error: null };
}
