import { listOffers } from '@/lib/offers';
import OfferList from '../offer-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'For Cerf · CardScout' };

// Cards CardScout could not settle for staff. Cerf opens each one and decides.
export default async function ReviewPage() {
  const { offers, error } = await listOffers();
  const waiting = offers.filter((o) => o.last_outcome === 'owner_review');
  return (
    <main>
      <header className="appbar">
        <h1>For Cerf</h1>
        <p className="sub">Cards that need the owner&apos;s judgement. Each one says what Cerf needs to decide.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && <OfferList offers={waiting} empty="Nothing waiting for Cerf." />}
    </main>
  );
}
