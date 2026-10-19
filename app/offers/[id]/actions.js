'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { OFFER_ID_PATTERN, setOfferPlayer } from '@/lib/offers';
import { getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';

function field(formData, name) {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

// Staff confirm which FM player an offer refers to. The server checks both ids.
export async function linkPlayer(formData) {
  const offerId = field(formData, 'offer_id');
  const playerId = field(formData, 'player_id');
  if (!OFFER_ID_PATTERN.test(offerId)) redirect('/');
  if (!PLAYER_ID_PATTERN.test(playerId)) redirect(`/offers/${offerId}?msg=bad-player`);
  const { player } = await getPlayer(playerId);
  if (!player) redirect(`/offers/${offerId}?msg=bad-player`);
  const { error } = await setOfferPlayer(offerId, playerId);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}?msg=${error ? 'save-failed' : 'linked'}`);
}

export async function unlinkPlayer(formData) {
  const offerId = field(formData, 'offer_id');
  if (!OFFER_ID_PATTERN.test(offerId)) redirect('/');
  const { error } = await setOfferPlayer(offerId, null);
  revalidatePath('/');
  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}?msg=${error ? 'save-failed' : 'unlinked'}`);
}
