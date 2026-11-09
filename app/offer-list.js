import Link from 'next/link';
import { OUTCOMES } from '@/lib/assess.mjs';
import CardThumb from './card-thumb';

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const time = new Intl.DateTimeFormat('en-AU', { timeStyle: 'short', timeZone: 'Australia/Sydney' });
const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);

// Same words as the card page.
const LABEL = { ...OUTCOMES, eligible: 'OK to buy', decline: "Don't buy", owner_review: 'Ask the owner', counteroffer: 'Counteroffer' };
// Once the owner has decided, the list shows his decision instead.
const OWNER = { buy: ['Owner: Buy', 'eligible'], dont_buy: ["Owner: Don't buy", 'decline'], offer: ['Owner: Offer', 'counteroffer'] };

// One tappable row per offer. Left: who and which card (wraps as needed). Right, fixed width: asking price, verdict, date.
export default function OfferList({ offers, empty }) {
  if (!offers.length) return <p className="empty">{empty}</p>;
  const today = dayKey(new Date());
  return (
    <ul className="offer-rows">
      {offers.map((o) => {
        const at = new Date(o.created_at);
        const [badge, tone] = OWNER[o.owner_decision] ?? [o.last_outcome ? LABEL[o.last_outcome] : 'Not assessed', o.last_outcome ?? 'none'];
        return (
          <li key={o.id}>
            <Link href={`/offers/${o.id}`} className={`offer-row sale-row outcome-${tone}${o.photo_path ? ' with-photo' : ''}`}>
              {/* A photo only when there is one, so rows without a photo carry no empty box. */}
              {o.photo_path && <CardThumb offer={o} />}
              <span className="row-body">
                <strong className="row-title">{o.player}</strong>
                <span className="row-sub">{o.year} · {o.set_name} · #{String(o.card_number).replace(/^#/, '')}</span>
                <span className="row-sub">{[o.variant, o.grade_condition].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="row-side">
                <span className="row-price">{aud.format(Number(o.asking_price_aud))}</span>
                <span className="badge">{badge}</span>
                <span className="row-date">{dayKey(at) === today ? time.format(at) : date.format(at)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
