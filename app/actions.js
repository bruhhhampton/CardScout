'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createOffer, setOfferPlayer } from '@/lib/offers';
import { findExactPlayer } from '@/lib/players';
import { readValues, validateOffer } from '@/lib/validate-offer';
import { cookies } from 'next/headers';
import { autoStart } from '@/lib/auto-assess';

const EMPTY = {
  player: '', year: '', set_name: '', card_number: '', variant: '', grade_condition: '', asking_price_aud: '',
};

// Runs on the server when the form is submitted.
export async function saveOffer(_previous, formData) {
  const values = readValues(formData);
  const attempt = Date.now();
  const result = validateOffer(values);

  if (!result.ok) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: result.errors, values, attempt };
  }

  const { id, error } = await createOffer(result.offer);
  if (error) {
    return { status: 'error', message: error, errors: {}, values, attempt };
  }

  // Link the Football Manager player straight away when exactly one name matches, so staff skip that step.
  let linked = false;
  if (id) {
    const match = await findExactPlayer(result.offer.player);
    if (match) linked = !(await setOfferPlayer(id, match.player_id)).error;
  }
  // Start the assessment straight away on a device that remembers the team passcode.
  const started = id ? await autoStart(id, await cookies()) : false;
  revalidatePath('/');
  // Open the new offer: it shows "Working on it" if the assessment started, otherwise the Assess button.
  if (id) redirect(`/offers/${id}?msg=${started ? 'created-started' : linked ? 'created-linked' : 'created'}`);
  return {
    status: 'success',
    message: `Saved offer for ${result.offer.player}. It is listed below as Not assessed.`,
    errors: {},
    values: EMPTY,
    attempt,
  };
}
