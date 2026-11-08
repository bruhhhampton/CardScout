import 'server-only';
import { getSupabase } from './supabase-server';

export const SCOUT_TIMEOUT_MS = 5 * 60 * 1000;
export const isScoutRunning = (r) => r?.status === 'running' && Date.now() - new Date(r.created_at).getTime() < SCOUT_TIMEOUT_MS;

// The latest scout run, or { run: null }. { missing: true } until database/013 is run.
export async function getLatestScout() {
  const supabase = getSupabase();
  if (!supabase) return { run: null };
  const { data, error } = await supabase.from('scout_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return { run: null, missing: /scout_runs/.test(`${error.message} ${error.details ?? ''}`) };
  return { run: data ?? null };
}

export async function countScoutsLastDay() {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from('scout_runs').select('id', { count: 'exact', head: true }).gte('created_at', since);
  return count ?? 0;
}

export async function startScout(model) {
  const supabase = getSupabase();
  if (!supabase) return { id: null, error: 'The server is not connected to the database.' };
  const { data, error } = await supabase.from('scout_runs').insert({ status: 'running', model }).select('id').single();
  if (error) {
    console.error('startScout failed:', error);
    return { id: null, error: /scout_runs/.test(`${error.message} ${error.details ?? ''}`) ? 'Run database/013_scout_runs.sql in Supabase first.' : 'The scout could not be started.' };
  }
  return { id: data.id, error: null };
}

export async function finishScout(id, row) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('scout_runs').update(row).eq('id', id);
  if (error) console.error('finishScout failed:', error);
}
