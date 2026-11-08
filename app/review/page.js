import { listOffers } from '@/lib/offers';
import OfferList from '../offer-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner review · CardScout' };

// Cards CardScout could not settle for staff. Cerf opens each one and decides.
export default async function ReviewPage() {
  const { offers, error } = await listOffers();
  const waiting = offers.filter((o) => o.last_outcome === 'owner_review');
  return (
    <main>
      <header className="appbar">
        <h1>Owner review</h1>
        <p className="sub">Cards that need the owner&apos;s judgement. Each one says what needs deciding.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && <OfferList offers={waiting} empty="Nothing waiting for the owner." />}
    </main>
  );
}
