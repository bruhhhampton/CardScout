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
  const { data, error } = await supabase.from('agent_runs').insert(row).select('id').single();
  if (error) {
    console.error('saveRun failed:', error);
    return { id: null, error: 'The AI draft ran but could not be saved.' };
  }
  return { id: data?.id ?? null, error: null };
}
