import 'server-only';
import { getSupabase } from './supabase-server';

export async function getSettings() {
  const supabase = getSupabase();
  if (!supabase) return { settings: null, error: 'The server is not connected to the database.' };
  const { data, error } = await supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) {
    if (error) console.error('getSettings failed:', error);
    return { settings: null, error: 'Owner settings are missing. Run database/003_settings_assessments.sql in Supabase.' };
  }
  return { settings: data, error: null };
}

export async function saveSettings(row) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'The server is not connected to the database.' };
  const { error } = await supabase
    .from('shop_settings')
    .update({ ...row, provisional: false, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('saveSettings failed:', error);
    return { error: 'Settings were not saved because the database rejected them. Check the values and try again.' };
  }
  return { error: null };
}
