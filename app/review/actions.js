'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { forgetLearned } from '@/lib/owner-decisions';
import { saveSettings } from '@/lib/settings';
import { isRemembered } from '@/lib/agent-access';
import { RULE_WORDS } from '@/lib/owner-decisions.mjs';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner removes something CardScout learned from his decisions. New assessments stop using it.
export async function forgetRule(formData) {
  const id = String(formData.get('decision_id') ?? '');
  if (!ID.test(id)) redirect('/settings');
  if (!isRemembered(await cookies())) redirect('/settings?learned=locked#learned');
  const { error } = await forgetLearned(id);
  revalidatePath('/settings');
  revalidatePath('/review');
  redirect(`/settings?learned=${error ? 'failed' : 'forgotten'}#learned`);
}

// One tap from the Owner tab: change the rule he keeps going against. Only the rules CardScout
// suggests, and only to the next gentler setting.
const ALLOWED = { base_rule: ['ask', 'allow'], maker_rule: ['ask', 'allow'], price_rule: ['ask', 'allow'], defect_rule: ['ask', 'allow'] };
export async function changeRule(formData) {
  const rule = String(formData.get('rule') ?? '');
  const value = String(formData.get('value') ?? '');
  if (!RULE_WORDS[rule]) redirect('/review');
  if (!isRemembered(await cookies())) redirect('/review?rule=locked');
  let row;
  if (rule === 'rookie_only') row = { rookie_only: false };
  else if (ALLOWED[rule]?.includes(value)) row = { [rule]: value };
  else redirect('/review');
  const { error } = await saveSettings(row);
  revalidatePath('/review');
  revalidatePath('/settings');
  redirect(`/review?rule=${error ? 'failed' : 'changed'}`);
}

// "Keep my rule": saving Settings resets the count, so the suggestion only comes back
// if he keeps going against the rule.
export async function keepRule() {
  if (!isRemembered(await cookies())) redirect('/review?rule=locked');
  const { error } = await saveSettings({});
  revalidatePath('/review');
  redirect(`/review?rule=${error ? 'failed' : 'kept'}`);
}
