'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';
import { choosePhoto, clearChoice } from '@/lib/player-photos';

// Staff choose which API-Football profile is this player, "None of these", or hand it back to the automatic search.
export async function choosePlayerPhoto(formData) {
  const id = String(formData.get('player_id') ?? '');
  if (!PLAYER_ID_PATTERN.test(id)) redirect('/find');
  const { player } = await getPlayer(id);
  if (!player) redirect('/find');
  const pick = String(formData.get('api_id') ?? '');
  let result;
  if (pick === 'auto') result = await clearChoice(player);
  else result = await choosePhoto(player, pick === 'none' ? null : pick, formData.get('api_name'));
  revalidatePath(`/players/${id}`);
  revalidatePath('/find/history');
  if (result.error) redirect(`/players/${id}/photo?error=${encodeURIComponent(result.error)}`);
  redirect(`/players/${id}?photo=${pick === 'none' ? 'none' : pick === 'auto' ? 'auto' : 'chosen'}`);
}
