import 'server-only';
import { getSupabase } from './supabase-server';

const NOT_CONNECTED = 'The server is not connected to the database.';
const COLUMNS = 'id, created_at, offer_id, assessment_id, decision, offer_aud, reason, suggested, player, year, set_name, variant, asking_price_aud';
const missingTable = (error) => /owner_decision/.test(`${error?.message} ${error?.details ?? ''}`);
export const SETUP_MESSAGE = 'Run database/016_owner_decisions.sql in Supabase first.';

// Saves the owner's decision next to CardScout's suggestion. Nothing is bought.
export async function saveOwnerDecision(offer, assessment, input) {
  const supabase = getSupabase();
  if (!supabase) return { error: NOT_CONNECTED };
  const { error } = await supabase.from('owner_decisions').insert({
    offer_id: offer.id,
    assessment_id: assessment?.id ?? null,
    decision: input.decision,
    offer_aud: input.offer_aud,
    reason: input.reason,
    suggested: assessment?.outcome ?? null,
    player: offer.player ?? '',
    year: offer.year ?? null,
    set_name: offer.set_name ?? '',
    variant: offer.variant ?? '',
    asking_price_aud: offer.asking_price_aud ?? null,
  });
  if (error) {
    console.error('saveOwnerDecision failed:', error);
    return { error: missingTable(error) ? SETUP_MESSAGE : 'The decision was not saved. Try again.' };
  }
  const { error: e2 } = await supabase.from('card_offers').update({ owner_decision: input.decision }).eq('id', offer.id);
  if (e2) console.error('owner_decision on offer failed:', e2);
  return { error: null };
}

// The owner's latest decision on one card, or null.
export async function getOwnerDecision(offerId) {
  const supabase = getSupabase();
  if (!supabase) return { decision: null };
  const { data, error } = await supabase.from('owner_decisions').select(COLUMNS)
    .eq('offer_id', offerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return { decision: null, missing: missingTable(error) };
  return { decision: data ?? null };
}

// Recent decisions, newest first, for matching and the Owner tab. Empty until database/016 is run.
export async function listOwnerDecisions(limit = 300) {
  const supabase = getSupabase();
  if (!supabase) return { decisions: [] };
  const { data, error } = await supabase.from('owner_decisions').select(COLUMNS)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return { decisions: [], missing: missingTable(error) };
  return { decisions: data ?? [] };
}
