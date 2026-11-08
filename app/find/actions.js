'use server';

import { after } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { MODEL } from '@/lib/agent';
import { runScout } from '@/lib/scout';
import { addSkip, countScoutsLastDay, finishScout, getLatestScout, isScoutRunning, startScout } from '@/lib/scout-runs';
import { AGENT_COOKIE, agentToken, cookieOptions, isRemembered, passcodeOk } from '@/lib/agent-access';

const SCOUT_DAILY_LIMIT = Number(process.env.SCOUT_DAILY_LIMIT || 10);

// One tap: the scout runs in the background and the Find page shows its picks when ready.
// Uses AI credit, so it needs the team passcode like the assessment does.
export async function scoutForMe(formData) {
  const back = (msg) => redirect(`/find?scout=${msg}`);
  if (!process.env.AGENT_PASSCODE || !process.env.ANTHROPIC_API_KEY) back('off');
  const jar = await cookies();
  if (!isRemembered(jar)) {
    if (!passcodeOk(formData.get('passcode'))) back('passcode');
    jar.set(AGENT_COOKIE, agentToken(), cookieOptions());
  }
  const { run } = await getLatestScout();
  if (isScoutRunning(run)) back('running');
  if ((await countScoutsLastDay()) >= SCOUT_DAILY_LIMIT) back('limit');
  const focus = String(formData.get('focus') ?? '').trim().slice(0, 120);
  const started = await startScout(MODEL);
  if (!started.id) back('setup');
  after(async () => {
    const row = await runScout({ focus });
    await finishScout(started.id, row);
  });
  revalidatePath('/find');
  back('started');
}

// "Not for us": the scout never suggests this player again.
export async function notForUs(formData) {
  const id = String(formData.get('player_id') ?? '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) redirect('/find');
  const { error } = await addSkip(id, formData.get('name'));
  revalidatePath('/find');
  redirect(`/find?scout=${error ? 'skip-failed' : 'skipped'}`);
}
