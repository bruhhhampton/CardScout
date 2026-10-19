import 'server-only';
import { getSupabase } from './supabase-server';

const COLUMNS =
  'id, created_at, player, year, set_name, card_number, variant, grade_condition, asking_price_aud, status';

const NOT_CONNECTED =
  'The server is not connected to the database yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local, then restart npm run dev.';

// Returns { offers, error }. "error" is a plain message that is safe to show
// in the browser. Raw database errors are only logged on the server.
export async function listOffers() {
  const supabase = getSupabase();
  if (!supabase) return { offers: [], error: NOT_CONNECTED };
  const { data, error } = await supabase
    .from('card_offers')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listOffers failed:', error);
    return {
      offers: [],
      error: 'Could not load offers from the database. Check the server terminal for details.',
    };
  }
  return { offers: data ?? [], error: null };
}

// Saves one already-validated offer. Returns { error } (null on success).
export async function createOffer(offer) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.from('card_offers').insert(offer);
  if (error) {
    console.error('createOffer failed:', error);
    return {
      error: 'The offer was not saved because the database rejected it. Check the details and try again.',
    };
  }
  return { error: null };
}
