import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { toFormValues } from '@/lib/settings-fields';
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
  return (
    <main>
      <header className="appbar">
        <h1>Owner settings</h1>
        <p className="sub">Your buying rules. Every assessment uses these, so staff apply your judgement the same way each time.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {settings && (
        <>
          {settings.provisional && (
            <p className="notice">
              Provisional values. The player weights and thresholds come from the owner&apos;s buying model. The spending,
              stock and pricing limits are placeholders until the owner confirms them. Choose No under &quot;Are these values
              still provisional?&quot; once the owner has confirmed them.
            </p>
          )}
          <p className="hint">There is no login yet. Anyone with this link can change these settings, so share it only with the team and tutor.</p>
          <p className="hint">
            {Object.keys(fx.rates).length
              ? `Today's exchange rates for overseas sales: ${Object.entries(fx.rates).map(([c, r]) => `A$${r} per 1 ${c}`).join(' · ')}${fx.date ? ` (${fx.date})` : ''}. Source: ${fx.source}. Your own rate below replaces today's rate.`
              : "Today's exchange rates could not be loaded. Overseas sales are only counted in currencies where you enter your own rate below."}
          </p>
          <section id="learned" className="panel learned" aria-labelledby="learned-heading">
            <h2 id="learned-heading">Learned from your decisions</h2>
            <p className="hint">When you decide a card, CardScout does the same next time for the same card (same player, year, set and version). It never pays more than you did or more than the staff limit, and a person still confirms. Remove anything you no longer want.</p>
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
          </section>
          <SettingsForm initial={toFormValues(settings)} />
        </>
      )}
      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
