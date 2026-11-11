// Team sign-in (12 Nov 2026). One team passcode (AGENT_PASSCODE, the same one that already unlocks
// the AI drafts). Signing in stores a token derived from the passcode in the cs_agent cookie, never
// the passcode itself, so changing the passcode in Vercel signs every phone out.
// No 'server-only' import here so proxy.js can use it too; it only runs on the server.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'cs_agent';
export const SESSION_DAYS = 30;

const digest = (text) => createHash('sha256').update(String(text ?? '')).digest();

export function sessionToken(passcode = process.env.AGENT_PASSCODE) {
  if (!passcode) return null;
  return createHmac('sha256', passcode).update('cardscout-agent-v1').digest('hex');
}
export function validSession(value, passcode = process.env.AGENT_PASSCODE) {
  const token = sessionToken(passcode);
  return Boolean(token && value) && timingSafeEqual(digest(value), digest(token));
}
export function passcodeMatches(given, passcode = process.env.AGENT_PASSCODE) {
  return Boolean(passcode) && timingSafeEqual(digest(given), digest(passcode));
}
// Where to go after signing in: only a path inside CardScout, never another site.
export function safeNext(next) {
  const n = String(next ?? '');
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') && !n.startsWith('/signin') ? n : '/';
}
