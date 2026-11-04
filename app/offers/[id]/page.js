import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOffer } from '@/lib/offers';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, getPlayer, searchPlayers } from '@/lib/players';
import { confirmVerdict, linkPlayer, unlinkPlayer } from './actions';
import { getLatestAssessment } from '@/lib/assessments';
import { getSettings } from '@/lib/settings';
import { OUTCOMES } from '@/lib/assess.mjs';
import { GATE_FIELDS, SCORE_FIELDS } from '@/lib/assessment-fields';
import AssessForm from './assess-form';
import AgentPanel from './agent-panel';
import { getLatestRun, isRunning } from '@/lib/agent-runs';
import RunWatcher from './run-watcher';
import { combineFootball, fmFit, ROLE_LABEL } from '@/lib/fm-fit.mjs';
import { headline, holdUps, ladder, sellerWords, whyLines } from '@/lib/explain.mjs';
import { cookies } from 'next/headers';
import { isRemembered } from '@/lib/agent-access';

export const dynamic = 'force-dynamic';
// AI drafts can take up to a minute.
export const maxDuration = 120;

// A normal eBay Australia search for this card: sold items, Australian sellers, newest first.
// It only opens eBay's own search page in a new tab; CardScout does not read eBay.
function searchWords(offer) {
  const variant = String(offer.variant ?? '').trim();
  // Short searches find more: sellers shorten set names (for example "Topps Chrome UCC").
  const set = String(offer.set_name ?? '').split(/\s+/).slice(0, 2).join(' ');
  const words = [offer.player, set, offer.card_number,
    /^base\b/i.test(variant) ? '' : variant.replace(/\(.*?\)/g, '')].filter(Boolean).join(' ').replace(/#/g, '').replace(/\s+/g, ' ').trim();
  return words;
}

function soldSearchUrl(offer) {
  const q = new URLSearchParams({ _nkw: searchWords(offer), LH_Sold: '1', LH_Complete: '1', LH_PrefLoc: '1', _sop: '13' });
  return `https://www.ebay.com.au/sch/i.html?${q}`;
}

// A normal SportsCardsPro search for this card. Staff open the card's page and copy its sold sales.
function priceSiteUrl(offer) {
  const q = new URLSearchParams({ q: searchWords(offer), type: 'prices' });
  return `https://www.sportscardspro.com/search-products?${q}`;
}

const GATE_LABEL = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

const MESSAGES = {
  created: { kind: 'success', text: 'Offer saved. Confirm the player, then enter stock and condition and click Prepare draft and assess.' },
  'created-linked': { kind: 'success', text: 'Offer saved and matched to its Football Manager player automatically. If it is the wrong player, click Remove link. Next: check stock and condition, then click Prepare draft and assess.' },
  confirmed: { kind: 'success', text: 'Verdict confirmed.' },
  'confirm-failed': { kind: 'error', text: 'The confirmation was not saved. Run database/007_confirm.sql in Supabase, then try again.' },
  linked: { kind: 'success', text: 'Player linked. CardScout uses these game ratings for 20% of football quality, as role fit. They are unverified, so real-world form counts for the other 80%.' },
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
  const remembered = isRemembered(await cookies());
  const [{ player, error: playerError }, { players: results, error: searchError }, { assessment }, { settings }, { run }] = await Promise.all([
    offer.player_id ? getPlayer(offer.player_id) : Promise.resolve({ player: null, error: null }),
    offer.player_id ? Promise.resolve({ players: [], error: null }) : searchPlayers(query),
    getLatestAssessment(offer.id),
    getSettings(),
    getLatestRun(offer.id),
  ]);
  const running = isRunning(run);
  const draft = run?.status === 'completed' ? run.draft : null;
  const usedRun = draft && (!assessment || new Date(run.created_at) > new Date(assessment.created_at)) ? run : null;
  const initial = usedRun
    ? {
        sales_count: String(usedRun.sales_count ?? 0),
        median_sold_aud: usedRun.median_sold_aud == null ? '' : String(usedRun.median_sold_aud),
        evidence_source: `AI draft ${new Date(usedRun.created_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}: ${(usedRun.sales ?? []).filter((x) => x.accepted).map((x) => x.url).join(' ')}`.slice(0, 500),
        ...Object.fromEntries(SCORE_FIELDS.map((f) => [f.name, draft.scores?.[f.key]?.score == null ? '' : String(draft.scores[f.key].score)])),
        // Cerf's two checks, as suggested by the AI (staff confirm or change them).
        ...Object.fromEntries(GATE_FIELDS.map((g) => [g.name, draft.checks?.[g.name]?.answer ?? ''])),
      }
    : assessment
      ? // No newer AI draft: start "Assess again" from the last assessment, so staff only change what changed.
        {
          stock_count: String(assessment.stock_count ?? ''),
          condition: assessment.condition ?? '',
          rookie_card: assessment.rookie_card ?? '',
          first_team: assessment.first_team ?? '',
          sales_count: String(assessment.sales_count ?? ''),
          median_sold_aud: assessment.median_sold_aud == null ? '' : String(assessment.median_sold_aud),
          evidence_source: assessment.evidence_source ?? '',
          ...Object.fromEntries(SCORE_FIELDS.map((f) => [f.name, assessment[f.name] == null ? '' : String(assessment[f.name])])),
          // The form asks for the real-world part; the FM part is added again on submit.
          ...(assessment.football_real != null ? { score_football: String(assessment.football_real) } : {}),
        }
      : {};
  const fromLast = !usedRun && Boolean(assessment);
  const fit = player ? fmFit(player) : null;

  const fmSection = (
        <section className="panel" aria-labelledby="fm-heading">
          <h2 id="fm-heading">Football Manager player context</h2>
          <p className="notice">
            Game ratings, unverified, never price evidence. From a community Football Manager 26 dataset. As in Cerf&apos;s
            model, the player&apos;s FM role fit counts for 20% of football quality; real-world evidence is the other 80%.
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
              <p className={fit ? 'success' : 'hint'}>
                {fit
                  ? `FM role fit: ${fit.score} as a ${ROLE_LABEL[fit.role]}. Counts for 20% of football quality in Cerf's model; real-world evidence is the other 80%.`
                  : "No attacking-role fit for this player in Cerf's model, so football quality uses real-world evidence only."}
              </p>
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
  );

  const asking = Number(offer.asking_price_aud);
  const head = assessment ? headline(assessment, asking) : null;
  const scale = assessment ? ladder(assessment, run, asking) : null;
  const why = assessment ? whyLines(assessment, offer, run) : [];
  const holds = assessment ? holdUps(assessment) : [];
  const agentPanel = (
    <AgentPanel offerId={offer.id} remembered={remembered} soldSearchUrl={soldSearchUrl(offer)} priceSiteUrl={priceSiteUrl(offer)}
      initial={assessment ? { stock_count: String(assessment.stock_count ?? ''), condition: assessment.condition ?? '' } : {}} />
  );

  return (
    <main>
      <p><Link href="/">← All offers</Link></p>

      <section className="card-label" aria-labelledby="offer-heading">
        <p className="card-line">{offer.year} {offer.set_name} #{String(offer.card_number).replace(/^#/, '')} · {offer.variant} · {offer.grade_condition}</p>
        <h1 id="offer-heading" className="offer-title">{offer.player}</h1>
        <p className="price">Seller asks {aud.format(asking)}</p>
      </section>

      {message && !(['created', 'created-linked'].includes(sp?.msg) && (run || assessment)) && (
        <p className={message.kind} role={message.kind === 'success' ? 'status' : 'alert'}>{message.text}</p>
      )}
      {run?.status === 'failed' && <p className="error" role="alert">The last assessment did not finish: {run.error}</p>}
      {run?.status === 'running' && !running && (
        <p className="error" role="alert">The last assessment stopped without finishing. Run it again.</p>
      )}

      {running ? (
        <section className="panel working" role="status">
          <p><strong>Working on it.</strong> Started {new Date(run.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })}, usually under a minute.</p>
          <p className="hint">You can start the next card; the verdict appears here on its own.</p>
          <RunWatcher startedAt={run.created_at} />
        </section>
      ) : assessment ? (
        <section className={`verdict tone-${head.tone}`} aria-labelledby="verdict-heading">
          <p className="verdict-kicker">{assessment.confirmed === false ? 'CardScout suggests' : 'Confirmed verdict'}</p>
          <h2 id="verdict-heading" className="verdict-title">{head.title}</h2>
          {scale && (
            <div className="ladder" aria-label="Price comparison">
              <div className="ladder-line" aria-hidden="true">
                {scale.points.map((p) => <span key={p.key} className={`ladder-dot dot-${p.key}`} style={{ left: `${p.at}%` }} />)}
              </div>
              <dl className="ladder-points">
                {scale.points.map((p) => (
                  <div key={p.key} className={`pt-${p.key}`}><dt>{p.label}</dt><dd>{p.text}</dd></div>
                ))}
              </dl>
              {scale.worthFrom && <p className="hint">Worth is the {scale.worthFrom}.</p>}
            </div>
          )}
          {holds.length > 0 && (
            <div className="holdups">
              <h3>{assessment.outcome === 'counteroffer' ? 'Why not the asking price' : assessment.outcome === 'decline' ? 'Why not' : 'What Cerf needs to decide'}</h3>
              <ul>{holds.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          <h3>What makes this card worth it (or not)</h3>
          <dl className="why">
            {why.map((w) => <div key={w.label}><dt>{w.label}</dt><dd>{w.text}</dd></div>)}
          </dl>
          <details className="seller">
            <summary>What to tell the seller</summary>
            <p>&ldquo;{sellerWords(assessment, asking)}&rdquo;</p>
          </details>
          {assessment.confirmed === false && (
            <form action={confirmVerdict} className="verdict-actions">
              <input type="hidden" name="offer_id" value={offer.id} />
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <button type="submit">Confirm</button>
              <span className="hint">Nothing is bought. Confirming records the decision.</span>
            </form>
          )}
        </section>
      ) : (
        <section className="panel" aria-labelledby="ready-heading">
          <h2 id="ready-heading">Assess this card</h2>
          <p className="hint">CardScout finds the price, researches the player and applies Cerf&apos;s rules. Nothing is bought.</p>
          {agentPanel}
        </section>
      )}

      <div className="more">
        {draft && (
          <details className="fold">
            <summary>How CardScout worked this out</summary>
            <div className="draft">
            <p className="hint">
              Drafted {new Date(run.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} · {run.model} · {run.searches} search(es)
            </p>
            <h3>Draft scores</h3>
            <ul className="draft-scores">
              {SCORE_FIELDS.map((f) => {
                const sc = draft.scores?.[f.key] ?? {};
                return (
                  <li key={f.key}>
                    <strong>{f.formLabel ?? f.label}: {sc.score ?? '–'}</strong>
                    {sc.flag && <span className="field-error"> · {sc.flag}</span>}
                    <div>{sc.reason}</div>
                    {sc.sources?.length > 0 && (
                      <div className="hint">
                        {sc.sources.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer nofollow">Source {i + 1}</a>
                        )).reduce((a, b) => [a, ' · ', b])}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {draft.checks && (
              <>
                <h3>Cerf&apos;s checks (AI suggestion, you confirm)</h3>
                <ul className="draft-scores">
                  {GATE_FIELDS.map((g) => {
                    const ch = draft.checks[g.name] ?? {};
                    return (
                      <li key={g.name}>
                        <strong>{g.label} {GATE_LABEL[ch.answer] ?? 'Not sure'}</strong>
                        {ch.flag && <span className="field-error"> · {ch.flag}</span>}
                        <div>{ch.reason}</div>
                        {ch.sources?.length > 0 && (
                          <div className="hint">
                            {ch.sources.map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer nofollow">Source {i + 1}</a>
                            )).reduce((a, b) => [a, ' · ', b])}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {run.price_guide && (
              <>
                <h3>Price guide (SportsCardsPro)</h3>
                {run.price_guide.found ? (
                  <div className="price-guide">
                    <p>
                      <a href={run.price_guide.link} target="_blank" rel="noopener noreferrer nofollow">{run.price_guide.name}</a>, {run.price_guide.set}, {run.price_guide.grade}
                    </p>
                    <dl className="result-facts">
                      <div><dt>Estimated value</dt><dd>{run.price_guide.value_aud != null ? aud.format(run.price_guide.value_aud) : '–'} (US${run.price_guide.value_usd?.toFixed(2)})</dd></div>
                      {run.price_guide.suggested_buy_aud != null && (
                        <div><dt>Their suggested shop buy price</dt><dd>{aud.format(run.price_guide.suggested_buy_aud)}</dd></div>
                      )}
                      {run.price_guide.sales_per_year != null && (
                        <div><dt>Sales per year</dt><dd>{run.price_guide.sales_per_year}</dd></div>
                      )}
                    </dl>
                    {run.median_sold_aud != null && run.price_guide.value_aud != null
                      && Math.abs(run.price_guide.value_aud - Number(run.median_sold_aud)) / Number(run.median_sold_aud) > 0.15 && (
                      <p className="field-error">
                        The price guide and the middle of the real sales differ by more than 15%
                        ({aud.format(run.price_guide.value_aud)} vs {aud.format(Number(run.median_sold_aud))}). Check which is more current.
                      </p>
                    )}
                    {run.price_guide.note && <p className="field-error">{run.price_guide.note}</p>}
                    <p className="hint">An estimate, not a sale. Converted at A${run.price_guide.rate} per US$ and your {Math.round((run.price_guide.adjust ?? 1) * 100)}% overseas share.</p>
                  </div>
                ) : (
                  <div className="price-guide">
                    <p>{run.price_guide.reason}</p>
                    {run.price_guide.candidates?.length > 0 && (
                      <p className="hint">Closest cards it found: {run.price_guide.candidates.join('; ')}</p>
                    )}
                  </div>
                )}
              </>
            )}
            <h3>Sold sales the AI found</h3>
            <p className="hint">
              Counted by the server: {run.sales_count} accepted
              {(run.sales ?? []).some((x) => x.accepted && x.overseas)
                ? ` (${(run.sales ?? []).filter((x) => x.accepted && !x.overseas).length} Australian, ${(run.sales ?? []).filter((x) => x.accepted && x.overseas).length} overseas, converted)`
                : ''}
              {run.median_sold_aud != null ? `, middle price ${aud.format(Number(run.median_sold_aud))}` : ''}. Open each link to check it.
            </p>
            {(run.sales ?? []).length === 0 ? <p className="empty">No sold sales recorded.</p> : (
              <ul className="draft-sales">
                {run.sales.map((x, i) => (
                  <li key={i} className={x.accepted ? 'ok' : 'rejected'}>
                    <span>{x.accepted ? 'Accepted' : 'Not counted'}</span>{' '}
                    {x.overseas ? `AUD ${Number(x.price_aud).toFixed(2)} (overseas: ${x.currency} ${x.price}${x.rate ? ` at A$${x.rate}` : ''}, after your adjustment)` : `${x.currency} ${x.price}`} · {x.sold_date} ·{' '}
                    <a href={x.url} target="_blank" rel="noopener noreferrer nofollow">{x.title || 'link'}</a>
                    {!x.accepted && <div className="hint">{(x.problems ?? []).join('; ')}</div>}
                  </li>
                ))}
              </ul>
            )}
            {draft.questions_for_staff?.length > 0 && (
              <>
                <h3>The AI needs you to check</h3>
                <ul>{draft.questions_for_staff.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </>
            )}
            <details>
              <summary>What the AI did (trace)</summary>
              <ol className="trace">
                {(run.trace ?? []).map((t, i) => (
                  <li key={i}>
                    {t.type === 'search' && <>Searched: “{t.query}”</>}
                    {t.type === 'search_results' && <>Got {t.results.length} result(s)</>}
                    {t.type === 'tool' && <>Used {t.name}{t.name === 'record_sale' ? (t.accepted ? ' (accepted)' : ` (rejected: ${t.problems?.join('; ')})`) : ''}</>}
                  </li>
                ))}
              </ol>
            </details>
          </div>
          </details>
        )}
        {assessment && !running && (
          <details className="fold">
            <summary>Run it again</summary>
            {agentPanel}
          </details>
        )}
        {settings ? (
          <details className="fold" open={false}>
            <summary>{assessment ? 'Change an answer or score' : 'Enter the evidence yourself'}</summary>
            <p className="hint">
              Uses the owner&apos;s rules from <Link href="/settings">Owner settings</Link>
              {settings?.provisional ? ' (provisional values)' : ''}.
            </p>
            <AssessForm key={usedRun?.id ?? 'manual'} offerId={offer.id} salesWindowDays={settings.sales_window_days}
              initial={initial} agentRunId={usedRun?.id ?? null} keepRunId={!usedRun ? assessment?.agent_run_id ?? null : null} fromLast={fromLast} />
          </details>
        ) : (
          <p className="error" role="alert">Owner settings are missing. Run database/003_settings_assessments.sql in Supabase.</p>
        )}
        <details className="fold">
          <summary>{player ? `Football Manager ratings: ${player.name}` : 'Football Manager player: not linked'}</summary>
          {fmSection}
        </details>
      </div>

      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
