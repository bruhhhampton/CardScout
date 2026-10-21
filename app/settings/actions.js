'use server';

import { revalidatePath } from 'next/cache';
import { saveSettings } from '@/lib/settings';
import { SETTINGS_FIELDS, validateSettings } from '@/lib/settings-fields';

export async function saveSettingsAction(_prev, formData) {
  const values = {};
  for (const f of SETTINGS_FIELDS) {
    const v = formData.get(f.name);
    values[f.name] = typeof v === 'string' ? v : '';
  }
  const attempt = Date.now();
  const check = validateSettings(values);
  if (!check.ok) return { status: 'error', message: 'Please fix the highlighted settings.', errors: check.errors, values, attempt };
  const { error } = await saveSettings(check.row);
  if (error) return { status: 'error', message: error, errors: {}, values, attempt };
  revalidatePath('/settings');
  revalidatePath('/');
  return { status: 'success', message: 'Settings saved. New assessments will use them.', errors: {}, values, attempt };
}
