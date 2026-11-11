'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { passcodeMatches, safeNext, SESSION_COOKIE, SESSION_DAYS, sessionToken } from '@/lib/team-session.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function signIn(_prev, formData) {
  const next = safeNext(formData.get('next'));
  if (!process.env.AGENT_PASSCODE) redirect(next);
  if (!passcodeMatches(String(formData.get('passcode') ?? ''))) {
    await sleep(800); // slows down guessing
    return { error: 'That passcode is not right. Ask the owner for it.' };
  }
  const keep = formData.get('keep') === 'on';
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Ticked: stays signed in for 30 days. Not ticked: until the browser is closed.
    ...(keep ? { maxAge: SESSION_DAYS * 24 * 60 * 60 } : {}),
  });
  redirect(next);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/signin');
}
