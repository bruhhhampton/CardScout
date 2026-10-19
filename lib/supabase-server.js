// Server-only Supabase connection.
// The "server-only" import makes the build fail if this file is ever
// pulled into browser code, so the secret key can never reach the browser.
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
