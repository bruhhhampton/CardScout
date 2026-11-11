import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { safeNext, SESSION_COOKIE, validSession } from '@/lib/team-session.mjs';
import SignInForm from './signin-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in · CardScout' };

// Shown only when signed out. Signed-in staff go straight on to Offers (or the page they asked for).
export default async function SignIn({ searchParams }) {
  const sp = await searchParams;
  const next = safeNext(sp?.next);
  if (!process.env.AGENT_PASSCODE || validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect(next);
  return (
    <main className="signin">
      <div className="signin-mid">
        <p className="signin-line">The shop&apos;s pricing tool for the counter.</p>
        <SignInForm next={next} />
      </div>
      <footer className="signin-foot">UNSW INFS3605 student project. The shop, its rules and the offers are fictional.</footer>
    </main>
  );
}
