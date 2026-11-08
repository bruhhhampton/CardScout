import Link from 'next/link';
import { listOffers } from '@/lib/offers';
import OfferList from './offer-list';

// Always read fresh rows from the database, never a cached copy.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { offers, error } = await listOffers();
  const waiting = offers.filter((o) => o.last_outcome === 'owner_review').length;

  return (
    <main>
      <header className="appbar">
        <h1>CardScout</h1>
        <p className="sub">Offers from sellers, newest first. Nothing is ever bought automatically.</p>
      </header>

      <Link href="/scan" className="cta">Scan a card</Link>
      {waiting > 0 && (
        <p><Link href="/review">{waiting} card{waiting === 1 ? '' : 's'} waiting for the owner</Link></p>
      )}

      <section aria-labelledby="offers-heading">
        <h2 id="offers-heading" className="list-heading">Offers</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {!error && <OfferList offers={offers} empty="No offers yet. Scan a card to start." />}
      </section>

      <footer>Development data is invented.</footer>
    </main>
  );
}
