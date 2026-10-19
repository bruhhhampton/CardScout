import { listOffers } from '@/lib/offers';

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
        <p className="sub">Card offers waiting for assessment, newest first.</p>
      </header>

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
              <h2>{o.player}</h2>
              <span className="badge">Not assessed</span>
            </div>
            <p className="card">
              {o.year} {o.set_name} #{o.card_number} · {o.variant}
            </p>
            <p className="condition">{o.grade_condition}</p>
            <div className="row">
              <span className="price">Asking {aud.format(Number(o.asking_price_aud))}</span>
              <time dateTime={o.created_at}>{when.format(new Date(o.created_at))}</time>
            </div>
          </li>
        ))}
      </ul>

      <footer>Development data is invented. CardScout never buys cards automatically.</footer>
    </main>
  );
}
