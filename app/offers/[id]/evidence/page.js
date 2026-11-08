import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOffer, OFFER_ID_PATTERN } from '@/lib/offers';
import { getLatestRun } from '@/lib/agent-runs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Evidence · CardScout' };

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const link = (u, text) => <a href={u} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;

// Everything behind one assessment, for checking: the price guide, every sale the AI found
// (counted or not, and why) and each step the AI took. Not needed day to day.
export default async function EvidencePage({ params }) {
  const { id } = await params;
  if (!OFFER_ID_PATTERN.test(id)) notFound();
  const [{ offer }, { run }] = await Promise.all([getOffer(id), getLatestRun(id)]);
  if (!offer) notFound();
  const g = run?.price_guide;
  const sales = run?.sales ?? [];
  return (
    <main>
      <p className="back"><Link href={`/offers/${offer.id}`}>← {offer.player}</Link></p>
      <header className="appbar">
        <h1>Evidence</h1>
        <p className="sub">{offer.year} {offer.set_name} #{String(offer.card_number).replace(/^#/, '')} · {offer.variant}</p>
      </header>
      {!run ? <p className="empty">No AI research for this card yet.</p> : (
        <>
          <p className="hint">Researched {new Date(run.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} · {run.model} · {run.searches} search(es)</p>

          <section className="panel">
            <h2>Price guide (SportsCardsPro)</h2>
            {!g ? <p className="empty">Not used.</p> : g.found ? (
              <>
                <p>{link(g.link, g.name)}, {g.set}, {g.grade}{g.picked_by_staff ? ' (version picked by staff)' : ''}</p>
                <p>{g.value_aud != null ? aud.format(g.value_aud) : '–'} (US${g.value_usd?.toFixed(2)}), converted at A${g.rate} per US$ and the owner&apos;s {Math.round((g.adjust ?? 1) * 100)}% overseas share.</p>
                {g.note && <p className="field-error">{g.note}</p>}
                <p className="hint">An estimate, not a sale. Never show this figure to a seller.</p>
              </>
            ) : (
              <>
                <p>{g.reason}</p>
                {g.candidates?.length > 0 && <p className="hint">Closest cards it found: {g.candidates.join('; ')}</p>}
              </>
            )}
          </section>

          <section className="panel">
            <h2>Sold sales the AI found</h2>
            <p className="hint">
              Counted by the server: {run.sales_count} accepted{run.median_sold_aud != null ? `, middle price ${aud.format(Number(run.median_sold_aud))}` : ''}. Open each link to check it.
            </p>
            {sales.length === 0 ? <p className="empty">No sold sales recorded.</p> : (
              <ul className="draft-sales">
                {sales.map((x, i) => (
                  <li key={i} className={x.accepted ? 'ok' : 'rejected'}>
                    <span>{x.accepted ? 'Counted' : 'Not counted'}</span>{' '}
                    {x.overseas ? `AUD ${Number(x.price_aud).toFixed(2)} (overseas: ${x.currency} ${x.price}${x.rate ? ` at A$${x.rate}` : ''})` : `${x.currency} ${x.price}`} · {x.sold_date} · {link(x.url, x.title || 'link')}
                    {!x.accepted && <div className="hint">{(x.problems ?? []).join('; ')}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>What the AI did, step by step</h2>
            <ol className="trace">
              {(run.trace ?? []).map((t, i) => (
                <li key={i}>
                  {t.type === 'search' && <>Searched: &ldquo;{t.query}&rdquo;</>}
                  {t.type === 'search_results' && <>Got {t.results.length} result(s)</>}
                  {t.type === 'tool' && <>Used {t.name}{t.name === 'record_sale' ? (t.accepted ? ' (counted)' : ` (not counted: ${t.problems?.join('; ')})`) : ''}</>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
