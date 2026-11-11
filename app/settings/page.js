import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { toFormValues } from '@/lib/settings-fields';
import { signOut } from '../signin/actions';
import SettingsForm from './settings-form';
import { getAudRates } from '@/lib/fx.mjs';
import { listOwnerDecisions } from '@/lib/owner-decisions';
import { decisionText, learnedList } from '@/lib/owner-decisions.mjs';
import { forgetRule } from '../review/actions';

const LEARNED_MSG = {
  forgotten: ['success', 'Removed. New assessments no longer use it.'],
  failed: ['error', 'Not removed. Run database/017_learned_rules.sql in Supabase, then try again.'],
  locked: ['error', 'Enter the team passcode once on this phone (on any card) before changing this.'],
};
const day = (d) => new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' });

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }) {
  const sp = await searchParams;
  const [{ settings, error }, fx, { decisions, learning }] = await Promise.all([getSettings(), getAudRates(), listOwnerDecisions(1000)]);
  const learned = learning ? learnedList(decisions) : [];
  const msg = LEARNED_MSG[sp?.learned];
  const fxNote = Object.keys(fx.rates).length
    ? `Today's rates: ${Object.entries(fx.rates).map(([c, r]) => `A$${r} per 1 ${c}`).join(' · ')}${fx.date ? ` (${fx.date})` : ''}. Source: ${fx.source}. Your own rate replaces today's rate.`
    : "Today's exchange rates could not be loaded. Overseas sales are only counted in currencies where you enter your own rate.";
  return (
    <main>
      <header className="appbar"><h1>Settings</h1></header>
      {error && <p className="error" role="alert">{error}</p>}
      {settings && (
        <>
          {settings.provisional && <p className="hint">Provisional values until the owner confirms them (see Shop).</p>}
          <form action={signOut} className="signout"><span className="hint">Signed in with the team passcode.</span> <button type="submit" className="linkbtn">Sign out</button></form>
          <details id="learned" className="group learned" open={learned.length > 0 || Boolean(msg)}>
            <summary><span>Learned decisions</span><span className="group-count">{learned.length}</span></summary>
            <p className="hint">CardScout repeats your decision for the same card (same player, year, set and version). It never pays more than you did or more than the staff limit, and a person still records it.</p>
            {msg && <p className={msg[0]} role={msg[0] === 'error' ? 'alert' : 'status'}>{msg[1]}</p>}
            {!learning && <p className="hint">Run database/017_learned_rules.sql in Supabase to turn this on.</p>}
            {learning && learned.length === 0 && <p className="empty">Nothing learned yet.</p>}
            <ul className="past-decisions">
              {learned.map((d) => (
                <li key={d.id} className={`d-${d.decision} learned-row`}>
                  <div>
                    <strong>{decisionText(d)}</strong> · <Link href={`/offers/${d.offer_id}`}>{d.player}, {[d.year, d.set_name, d.variant].filter(Boolean).join(' ')}</Link>
                    {d.reason && <div>&ldquo;{d.reason}&rdquo;</div>}
                    <div className="hint">From your decision on {day(d.created_at)}</div>
                  </div>
                  <form action={forgetRule}>
                    <input type="hidden" name="decision_id" value={d.id} />
                    <button type="submit" className="chip">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
          <SettingsForm initial={toFormValues(settings)} notes={{ 'Overseas sales': fxNote }} />
        </>
      )}
      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
