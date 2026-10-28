// Remembers the team passcode on a device with a cookie, so staff do not retype it
// for every AI draft. The cookie holds a hash derived from the passcode, never the
// passcode itself, and stops working as soon as AGENT_PASSCODE is changed.
import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const AGENT_COOKIE = 'cs_agent';
export const AGENT_COOKIE_DAYS = 30;

function digest(text) {
  return createHash('sha256').update(String(text ?? '')).digest();
}

export function passcodeOk(given) {
  const expected = process.env.AGENT_PASSCODE;
  if (!expected) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

export function agentToken() {
  const expected = process.env.AGENT_PASSCODE;
  if (!expected) return null;
  return createHmac('sha256', expected).update('cardscout-agent-v1').digest('hex');
}

// cookieStore is the result of next/headers cookies().
export function isRemembered(cookieStore) {
  const token = agentToken();
  const given = cookieStore.get(AGENT_COOKIE)?.value;
  if (!token || !given) return false;
  return timingSafeEqual(digest(given), digest(token));
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AGENT_COOKIE_DAYS * 24 * 60 * 60,
  };
}
