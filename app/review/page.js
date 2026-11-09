import Link from 'next/link';
import { listOffers } from '@/lib/offers';
import { listOwnerDecisions, SETUP_MESSAGE } from '@/lib/owner-decisions';
import { compareWithSuggestion, comparisonText, decisionText } from '@/lib/owner-decisions.mjs';
import OfferList from '../offer-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner · CardScout' };

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const day = (d) => new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' });

// Cards CardScout could not settle for staff, then what the owner decided and how often
// he did what CardScout suggested.
export default async function ReviewPage() {
  const [{ offers, error }, { decisions, missing }] = await Promise.all([listOffers(), listOwnerDecisions(100)]);
  const waiting = offers.filter((o) => o.last_outcome === 'owner_review' && !o.owner_decision);
  // Only his latest decision on each card.
  const seen = new Set();
  const latest = decisions.filter((d) => (seen.has(d.offer_id) ? false : seen.add(d.offer_id)));
  const settled = latest.filter((d) => compareWithSuggestion(d) !== 'asked');
  const agreed = settled.filter((d) => compareWithSuggestion(d) === 'agreed').length;

  return (
    <main>
      <header className="appbar">
        <h1>Owner</h1>
        <p className="sub">Cards that need the owner&apos;s judgement. Tap one, then Buy, Don&apos;t buy or Offer.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && (
        <>
          <h2 className="list-heading">Waiting for you{waiting.length ? ` (${waiting.length})` : ''}</h2>
          <OfferList offers={waiting} empty="Nothing waiting for the owner." />
        </>
      )}

      <section aria-labelledby="decided-heading">
        <h2 id="decided-heading" className="list-heading">Decided</h2>
        {missing && <p className="error" role="alert">{SETUP_MESSAGE}</p>}
        {!missing && latest.length === 0 && <p className="empty">No decisions yet. They show here with CardScout&apos;s suggestion next to each.</p>}
        {settled.length > 0 && (
          <p className="hint">On cards CardScout settled itself, the owner did the same on {agreed} of {settled.length}. Where he did not, check whether a rule in Settings should change.</p>
        )}
        <ul className="past-decisions">
          {latest.slice(0, 20).map((d) => (
            <li key={d.id} className={`d-${d.decision}`}>
              <strong>{decisionText(d)}</strong> · <Link href={`/offers/${d.offer_id}`}>{d.player}, {[d.year, d.set_name, d.variant].filter(Boolean).join(' ')}</Link>
              {d.asking_price_aud != null && <span className="hint"> · asked {aud.format(Number(d.asking_price_aud))}</span>}
              {d.reason && <div>&ldquo;{d.reason}&rdquo;</div>}
              <div className="hint">{day(d.created_at)} · {comparisonText(d)}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
