'use server';

import { cookies } from 'next/headers';
import { readCard } from '@/lib/scan';
import { listVariants } from '@/lib/price-guide';
import { AGENT_COOKIE, agentToken, cookieOptions, isRemembered, passcodeOk } from '@/lib/agent-access';

const MAX_BYTES = 3 * 1024 * 1024;

function image(formData, name) {
  const v = formData.get(name);
  if (typeof v !== 'string' || !v) return null;
  const m = v.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m || (m[2].length * 3) / 4 > MAX_BYTES) return 'bad';
  return { media_type: m[1], data: m[2] };
}

// Staff take a photo; CardScout reads the card and lists the versions SportsCardsPro knows.
// Uses AI credit, so it needs the team passcode like the assessment does. Nothing is saved here.
export async function scanCard(_prev, formData) {
  const attempt = Date.now();
  const fail = (message) => ({ status: 'error', message, attempt });
  if (!process.env.AGENT_PASSCODE) return fail('Scanning is locked: AGENT_PASSCODE is not set on the server.');
  const jar = await cookies();
  if (!isRemembered(jar)) {
    if (!passcodeOk(formData.get('passcode'))) return fail('Wrong team passcode. Nothing was scanned.');
    jar.set(AGENT_COOKIE, agentToken(), cookieOptions());
  }
  const front = image(formData, 'front');
  const back = image(formData, 'back');
  if (!front) return fail('Take a photo of the front of the card first.');
  if (front === 'bad' || back === 'bad') return fail('That photo could not be used. Try taking it again.');
  const read = await readCard([front, back].filter(Boolean));
  if (read.error) return fail(read.error);
  const { variants, reason } = await listVariants(read.card);
  return { status: 'success', attempt, card: read.card, unsure: read.unsure, note: read.note, variants, variantsReason: reason ?? null };
}
