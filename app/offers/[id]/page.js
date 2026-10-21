import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOffer } from '@/lib/offers';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, getPlayer, searchPlayers } from '@/lib/players';
import { linkPlayer, unlinkPlayer } from './actions';
import { getLatestAssessment } from '@/lib/assessments';
import { getSettings } from '@/lib/settings';
import { OUTCOMES } from '@/lib/assess.mjs';
import { SCORE_FIELDS } from '@/lib/assessment-fields';
import AssessForm from './assess-form';

export const dynamic = 'force-dynamic';

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

const MESSAGES = {
  linked: { kind: 'success', text: 'Player linked. The ratings below are context only and do not change the assessment.' },
  unlinked: { kind: 'success', text: 'Player link removed.' },
  'bad-player': { kind: 'error', text: 'That player could not be found. Search again and pick from the list.' },
  'save-failed': { kind: 'error', text: 'The change was not saved. Try again.' },
};

export default async function OfferPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { offer, error } = await getOffer(id);

  if (error) {
    return (
      <main>
        <p><Link href="/">← All offers</Link></p>
        <p className="error" role="alert">{error}</p>
      </main>
    );
  }
  if (!offer) notFound();

  const query = typeof sp?.q === 'string' ? sp.q : offer.player;
  const message = MESSAGES[sp?.msg];
  const [{ player, error: playerError }, { players: results, error: searchError }, { assessment }, { settings }] = await Promise.all([
    offer.player_id ? getPlayer(offer.player_id) : Promise.resolve({ player: null, error: null }),
    offer.player_id ? Promise.resolve({ players: [], error: null }) : searchPlayers(query),
    getLatestAssessment(offer.id),
    getSettings(),
  ]);

  return (
    <main>
      <p><Link href="/">← All offers</Link></p>

      <section className="panel" aria-labelledby="offer-heading">
        <div className="row">
          <h1 id="offer-heading" className="offer-title">{offer.player}</h1>
          <span className={`badge outcome-${offer.last_outcome ?? 'none'}`}>
            {offer.last_outcome ? OUTCOMES[offer.last_outcome] : 'Not assessed'}
          </span>
        </div>
        <p className="card">{offer.year} {offer.set_name} #{offer.card_number} · {offer.variant}</p>
        <p className="condition">{offer.grade_condition}</p>
        <p className="price">Asking {aud.format(Number(offer.asking_price_aud))}</p>
      </section>

      {message && (
        <p className={message.kind} role={message.kind === 'success' ? 'status' : 'alert'}>{message.text}</p>
      )}


      <section className="panel" aria-labelledby="assess-heading">
        <h2 id="assess-heading">Assessment</h2>
        <p className="hint">
          Uses the owner&apos;s rules from <Link href="/settings">Owner settings</Link>
          {settings?.provisional ? ' (provisional values)' : ''}. Plain calculation, no AI. Nothing is bought automatically.
        </p>
        {assessment && (
          <div className={`result outcome-${assessment.outcome}`} role="status">
            <p className="result-outcome">{OUTCOMES[assessment.outcome]}</p>
            <ul>{(assessment.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}</ul>
            <dl className="result-facts">
              <div><dt>Offer ceiling</dt><dd>{assessment.offer_ceiling_aud == null ? 'Not enough sales' : aud.format(Number(assessment.offer_ceiling_aud))}</dd></div>
              <div><dt>CERF total</dt><dd>{assessment.cerf_total} / 100 ({assessment.cerf_category?.toLowerCase()})</dd></div>
              <div><dt>Scores</dt><dd>{SCORE_FIELDS.map((f) => `${f.label} ${assessment[f.name]}`).join(' · ')}</dd></div>
              <div><dt>Sales evidence</dt><dd>{assessment.sales_count} sale(s){assessment.median_sold_aud != null ? `, median ${aud.format(Number(assessment.median_sold_aud))}` : ''}{assessment.evidence_source ? ` · ${assessment.evidence_source}` : ''}</dd></div>
              <div><dt>Assessed</dt><dd>{new Date(assessment.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</dd></div>
            </dl>
          </div>
        )}
        {settings ? (
          <details open={!assessment}>
            <summary>{assessment ? 'Assess again' : 'Enter the evidence'}</summary>
            <AssessForm offerId={offer.id} salesWindowDays={settings.sales_window_days} />
          </details>
        ) : (
          <p className="error" role="alert">Owner settings are missing. Run database/003_settings_assessments.sql in Supabase.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="fm-heading">
        <h2 id="fm-heading">Football Manager player context</h2>
        <p className="notice">
          Game ratings, unverified, not price evidence. These come from a community Football Manager 26 dataset and
          are shown for context only. They do not affect whether the card should be bought.
        </p>

        {playerError && <p className="error" role="alert">{playerError}</p>}

        {player ? (
          <>
            <div className="row">
              <div>
                <h3 className="player-name">{player.name}</h3>
                <p className="hint">
                  {player.position} · {player.club_snapshot} · age {player.age_snapshot} at snapshot
                </p>
              </div>
              <form action={unlinkPlayer}>
                <input type="hidden" name="offer_id" value={offer.id} />
                <button type="submit" className="secondary">Remove link</button>
              </form>
            </div>
            <div className="attr-groups">
              {ATTRIBUTE_GROUPS.map((g) => (
                <div key={g.label} className="attr-group">
                  <h4>{g.label}</h4>
                  <dl>
                    {g.keys.map((k) => (
                      <div key={k} className="attr">
                        <dt>{ATTRIBUTE_LABELS[k]}</dt>
                        <dd>
                          <span className="bar" aria-hidden="true">
                            <span style={{ width: `${(Number(player[k]) / 20) * 100}%` }} />
                          </span>
                          <span className="attr-value">{player[k]}<span className="hint"> / 20</span></span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="hint">
              Club and age are from an undated snapshot. Status: {player.data_status}. Source: {player.source}.
            </p>
          </>
        ) : (
          <>
            <p>Find the player this card shows, then confirm the match. The app never matches automatically.</p>
            <form method="get" className="search-row" role="search">
              <label htmlFor="q" className="sr-only">Player name</label>
              <input id="q" name="q" type="search" defaultValue={query} maxLength={60} placeholder="Player name" />
              <button type="submit" className="secondary">Search</button>
            </form>
            <p className="hint">Search ignores capital letters but not accents. If nothing shows, try part of the name.</p>

            {searchError && <p className="error" role="alert">{searchError}</p>}
            {!searchError && query.trim().length < 2 && <p className="hint">Type at least 2 letters.</p>}
            {!searchError && query.trim().length >= 2 && results.length === 0 && (
              <p className="empty">No players found for “{query}”.</p>
            )}

            {results.length > 0 && (
              <ul className="results">
                {results.map((p) => (
                  <li key={p.player_id} className="result">
                    <div>
                      <strong>{p.name}</strong>
                      <span className="hint"> · {p.position} · {p.club_snapshot} · age {p.age_snapshot} at snapshot</span>
                    </div>
                    <form action={linkPlayer}>
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <input type="hidden" name="player_id" value={p.player_id} />
                      <button type="submit" className="secondary">This is the player</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <footer>Development data is invented. CardScout never buys cards automatically.</footer>
    </main>
  );
}
