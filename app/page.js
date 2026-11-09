import { listOffers } from '@/lib/offers';
import OfferList from './offer-list';

// Always read fresh rows from the database, never a cached copy.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { offers, error } = await listOffers();

  return (
    <main className="home">
      <section aria-labelledby="offers-heading">
        <div className="screen-head">
          <h1 id="offers-heading">Offers</h1>
          <span className="hint">{offers.length} offer{offers.length === 1 ? '' : 's'} · Newest first</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {!error && <OfferList offers={offers} empty="No offers yet. Scan a card to start." />}
      </section>

      <footer>Nothing is ever bought automatically. Development data is invented.</footer>
    </main>
  );
}
