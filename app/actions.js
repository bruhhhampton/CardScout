'use server';

import { revalidatePath } from 'next/cache';
import { createOffer } from '@/lib/offers';
import { readValues, validateOffer } from '@/lib/validate-offer';

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

  const { error } = await createOffer(result.offer);
  if (error) {
    return { status: 'error', message: error, errors: {}, values, attempt };
  }

  revalidatePath('/');
  return {
    status: 'success',
    message: `Saved offer for ${result.offer.player}. It is listed below as Not assessed.`,
    errors: {},
    values: EMPTY,
    attempt,
  };
}
