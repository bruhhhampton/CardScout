import Link from 'next/link';
import { OUTCOMES } from '@/lib/assess.mjs';

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const time = new Intl.DateTimeFormat('en-AU', { timeStyle: 'short', timeZone: 'Australia/Sydney' });
const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);

const LABEL = { ...OUTCOMES, owner_review: 'Ask the owner', counteroffer: 'Counteroffer' };

// One tappable row per offer: who, which card, the asking price and the verdict.
export default function OfferList({ offers, empty }) {
  if (!offers.length) return <p className="empty">{empty}</p>;
  const today = dayKey(new Date());
  return (
    <ul className="offer-rows">
      {offers.map((o) => {
        const at = new Date(o.created_at);
        return (
          <li key={o.id}>
            <Link href={`/offers/${o.id}`} className={`offer-row outcome-${o.last_outcome ?? 'none'}`}>
              <span className="offer-main">
                <strong>{o.player}</strong>
                <span className="hint">{o.year} {o.set_name} #{String(o.card_number).replace(/^#/, '')} · {o.variant}</span>
              </span>
              <span className="offer-side">
                <span className="badge">{o.last_outcome ? LABEL[o.last_outcome] : 'Not assessed'}</span>
                <span className="hint">{aud.format(Number(o.asking_price_aud))} · {dayKey(at) === today ? time.format(at) : date.format(at)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
