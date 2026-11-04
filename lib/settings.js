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
  const save = (r) => supabase.from('shop_settings').update({ ...r, updated_at: new Date().toISOString() }).eq('id', 1);
  let { error } = await save(row);
  // Safety net: if database/008, 009 or 011 has not been run yet, save the other settings.
  const NEW = ['count_overseas', 'overseas_adjust', 'fx_usd_aud', 'fx_gbp_aud', 'fx_eur_aud', 'rookie_only', 'price_guide_as_evidence', 'price_guide_limit_aud'];
  if (error && NEW.some((c) => `${error.message} ${error.details ?? ''}`.includes(c))) {
    console.error('New settings columns missing; run database/008_overseas.sql, 009_rookie_rule.sql and 011_price_guide.sql. Saving the rest.');
    const rest = Object.fromEntries(Object.entries(row).filter(([k]) => !NEW.includes(k)));
    ({ error } = await save(rest));
    if (!error) return { error: 'Saved, except the newest settings: run database/008_overseas.sql, 009_rookie_rule.sql and 011_price_guide.sql in Supabase first.' };
  }
  if (error) {
    console.error('saveSettings failed:', error);
    return { error: 'Settings were not saved because the database rejected them. Check the values and try again.' };
  }
  return { error: null };
}
