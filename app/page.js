import Link from 'next/link';
import { listOffers } from '@/lib/offers';
import { OUTCOMES } from '@/lib/assess.mjs';
import OfferForm from './offer-form';

// Always read fresh rows from the database, never a cached copy.
export const dynamic = 'force-dynamic';

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const when = new Intl.DateTimeFormat('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Australia/Sydney',
});

export default async function Home() {
  const { offers, error } = await listOffers();

  return (
    <main>
      <header>
        <h1>CardScout</h1>
        <p className="sub">Record card offers for assessment. Newest offers are listed first.</p>
        <p><Link href="/settings">Owner settings</Link></p>
      </header>

      <OfferForm />

      <section aria-labelledby="offers-heading">
        <h2 id="offers-heading" className="list-heading">Saved offers</h2>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!error && offers.length === 0 && <p className="empty">No offers saved yet.</p>}

        <ul className="offers">
          {offers.map((o) => (
            <li key={o.id} className="offer">
              <div className="row">
                <h3>{o.player}</h3>
                <span className={`badge outcome-${o.last_outcome ?? 'none'}`}>
                  {o.last_outcome ? OUTCOMES[o.last_outcome] : 'Not assessed'}
                </span>
              </div>
              <p className="card">
                {o.year} {o.set_name} #{o.card_number} · {o.variant}
              </p>
              <p className="condition">{o.grade_condition}</p>
              <div className="row">
                <span className="price">Asking {aud.format(Number(o.asking_price_aud))}</span>
                <time dateTime={o.created_at}>{when.format(new Date(o.created_at))}</time>
              </div>
              <div className="row offer-links">
                <span className="hint">
                  {o.players?.name ? `FM player: ${o.players.name}` : 'No FM player linked'}
                </span>
                <Link href={`/offers/${o.id}`}>
                  {o.last_outcome ? 'View assessment' : 'Assess offer'}
                  <span className="sr-only"> for {o.player}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer>Development data is invented. CardScout never buys cards automatically.</footer>
    </main>
  );
}
