import 'server-only';
import { getSupabase } from './supabase-server';

const COLUMNS =
  'id, created_at, player, year, set_name, card_number, variant, grade_condition, asking_price_aud, status, player_id, last_outcome';
// Added by later database files. Until they are run, offers load without them.
const OPTIONAL = ['owner_decision', 'photo_path'];
const text = (error) => `${error?.message} ${error?.details ?? ''}`;
// Runs a select with every optional column, dropping any the database does not have yet.
async function withOptional(run) {
  let extra = [...OPTIONAL];
  for (;;) {
    const result = await run([COLUMNS, ...extra].join(', '));
    const gone = result.error ? extra.find((c) => text(result.error).includes(c)) : null;
    if (!gone) return result;
    extra = extra.filter((c) => c !== gone);
  }
}

const NOT_CONNECTED =
  'The server is not connected to the database yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local, then restart npm run dev.';

export const OFFER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns { offers, error }. "error" is a plain message that is safe to show
// in the browser. Raw database errors are only logged on the server.
export async function listOffers() {
  const supabase = getSupabase();
  if (!supabase) return { offers: [], error: NOT_CONNECTED };
  const { data, error } = await withOptional((cols) => supabase.from('card_offers').select(`${cols}, players(name)`).order('created_at', { ascending: false }));
  if (error) {
    console.error('listOffers failed:', error);
    return {
      offers: [],
      error: 'Could not load offers from the database. Check the server terminal for details.',
    };
  }
  return { offers: data ?? [], error: null };
}

// Returns { offer, error }. offer is null when the id is malformed or not found.
export async function getOffer(id) {
  if (!OFFER_ID_PATTERN.test(id ?? '')) return { offer: null, error: null };
  const supabase = getSupabase();
  if (!supabase) return { offer: null, error: NOT_CONNECTED };
  const { data, error } = await withOptional((cols) => supabase.from('card_offers').select(cols).eq('id', id).maybeSingle());
  if (error) {
    console.error('getOffer failed:', error);
    return { offer: null, error: 'Could not load this offer. Check the server terminal for details.' };
  }
  return { offer: data, error: null };
}

// Saves one already-validated offer. Returns { id, error } (error null on success).
export async function createOffer(offer) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { data, error } = await supabase.from('card_offers').insert(offer).select('id').single();
  if (error) {
    console.error('createOffer failed:', error);
    return {
      error: 'The offer was not saved because the database rejected it. Check the details and try again.',
    };
  }
  return { id: data?.id ?? null, error: null };
}

// Links an offer to a player (playerId) or removes the link (null). Returns { error }.
export async function setOfferPlayer(offerId, playerId) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.from('card_offers').update({ player_id: playerId }).eq('id', offerId);
  if (error) {
    console.error('setOfferPlayer failed:', error);
    return { error: 'The player link was not saved. Try again.' };
  }
  return { error: null };
}

// Sets the card's version to the one staff picked from SportsCardsPro's list. Returns { error }.
export async function setOfferVariant(offerId, variant) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.from('card_offers').update({ variant: String(variant).slice(0, 80) }).eq('id', offerId);
  if (error) {
    console.error('setOfferVariant failed:', error);
    return { error: 'The version was not saved. Try again.' };
  }
  return { error: null };
}
