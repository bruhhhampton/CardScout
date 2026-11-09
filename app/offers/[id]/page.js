import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOffer } from '@/lib/offers';
import { confirmVerdict, pickVersion } from './actions';
import { getLatestAssessment } from '@/lib/assessments';
import { getSettings } from '@/lib/settings';
import { OUTCOMES } from '@/lib/assess.mjs';
import { GATE_FIELDS, SCORE_FIELDS } from '@/lib/assessment-fields';
import AssessForm from './assess-form';
import AgentPanel from './agent-panel';
import { getLatestRun, isRunning } from '@/lib/agent-runs';
import RunWatcher from './run-watcher';
import { headline, holdUps, ladder, sellerWords, STATUS_WORDS, walkthrough, whyLines } from '@/lib/explain.mjs';
import CopyButton from './copy-button';
import { cookies } from 'next/headers';
import { versionLabels } from '@/lib/price-guide.mjs';
import { isRemembered } from '@/lib/agent-access';
import { getOwnerDecision, listOwnerDecisions } from '@/lib/owner-decisions';
import { comparisonText, compareWithSuggestion, decisionText, ownerSellerWords, similarDecisions } from '@/lib/owner-decisions.mjs';
import OwnerDecision from './owner-decision';
import Tabs from '../../tabs';
import CardThumb from '../../card-thumb';
import AddPhoto from './add-photo';

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
  created: { kind: 'success', text: 'Offer saved. Check stock and condition, then click Assess this card.' },
  'created-linked': { kind: 'success', text: 'Offer saved. Check stock and condition, then click Assess this card.' },
  'created-started': { kind: 'success', text: 'Offer saved. CardScout started assessing it with 0 in stock and condition meeting the standard. If either is wrong, change it under Run it again.' },
  confirmed: { kind: 'success', text: 'Verdict confirmed.' },
  decided: { kind: 'success', text: "Decision saved. Staff can tell the seller. Nothing is bought." },
  picked: { kind: 'success', text: 'Version saved. CardScout used its SportsCardsPro price and worked out the verdict again.' },
  'picked-no-price': { kind: 'error', text: 'Version saved, but SportsCardsPro has no price for this grade, so the verdict uses real sales instead.' },
  'pick-locked': { kind: 'error', text: 'Enter the team passcode once on this device (Assess this card) before picking a version.' },
  'pick-failed': { kind: 'error', text: 'That version could not be saved. Try again.' },
  'confirm-failed': { kind: 'error', text: 'The confirmation was not saved. Run database/007_confirm.sql in Supabase, then try again.' },
  'save-failed': { kind: 'error', text: 'The change was not saved. Try again.' },
};

export default async function OfferPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { offer, error } = await getOffer(id);

  if (error) {
    return (
      <main>
        <p className="back"><Link href="/">← Offers</Link></p>
        <p className="error" role="alert">{error}</p>
      </main>
    );
  }
  if (!offer) notFound();

  const also = Number(sp?.also) || 0;
  const message = sp?.msg === 'decided' && also
    ? { kind: 'success', text: `Decision saved. CardScout also updated ${also} other card${also === 1 ? '' : 's'} waiting for you that ${also === 1 ? 'is' : 'are'} the same card. Nothing is bought.` }
    : MESSAGES[sp?.msg];
  const remembered = isRemembered(await cookies());
  const [{ assessment }, { settings }, { run }, { decision: owner }, { decisions: past }] = await Promise.all([
    getLatestAssessment(offer.id),
    getSettings(),
    getLatestRun(offer.id),
    getOwnerDecision(offer.id),
    listOwnerDecisions(),
  ]);
  // How the owner decided cards like this one before.
  const similar = similarDecisions(offer, past);
  // The owner's decision this verdict learned from, if any.
  const learnedFrom = assessment?.learned_from ? past.find((d) => d.id === assessment.learned_from) ?? null : null;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' });
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
  const asking = Number(offer.asking_price_aud);
  const head = assessment ? headline(assessment, asking) : null;
  const scale = assessment ? ladder(assessment, run, asking) : null;
  const why = assessment ? whyLines(assessment, offer, run) : [];
  const holds = assessment ? holdUps(assessment) : [];
  // The four questions Cerf asks, with the sums, for staff to learn from.
  const steps = assessment && !running ? walkthrough(assessment, run, offer, settings ?? {}) : [];
  // The owner's offer box starts at CardScout's highest offer, if it is below the asking price.
  const suggestedOffer = assessment?.offer_ceiling_aud != null && Number(assessment.offer_ceiling_aud) < asking ? String(Number(assessment.offer_ceiling_aud)) : null;
  const askOwner = assessment?.outcome === 'owner_review' && !owner;
  const seller = owner ? ownerSellerWords(owner, asking) : assessment ? sellerWords(assessment, asking) : '';
  const agentPanel = (
    <AgentPanel offerId={offer.id} remembered={remembered} soldSearchUrl={soldSearchUrl(offer)} priceSiteUrl={priceSiteUrl(offer)}
      initial={assessment ? { stock_count: String(assessment.stock_count ?? ''), condition: assessment.condition ?? '' } : {}} />
  );

  return (
    <main>
      <Link href="/" className="back-arrow" aria-label="Back to offers">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6" /></svg>
      </Link>

      <div className="card-head">
        <section className="card-label" aria-labelledby="offer-heading">
          <p className="card-line">{offer.year} {offer.set_name}</p>
          <h1 id="offer-heading" className="offer-title">{offer.player} #{String(offer.card_number).replace(/^#/, '')}</h1>
          <dl className="card-facts">
            <div><dt>Version</dt><dd><span className="boxed">{offer.variant || 'Base'}</span></dd></div>
            <div><dt>Condition</dt><dd>{offer.grade_condition}</dd></div>
            <div><dt>Seller asks</dt><dd className="price">{aud.format(asking)}</dd></div>
          </dl>
        </section>
        <div className="photo-col">
          <CardThumb offer={offer} big />
          <AddPhoto offerId={offer.id} has={Boolean(offer.photo_path)} />
        </div>
      </div>

      {message && !(['created', 'created-linked'].includes(sp?.msg) && (run || assessment)) && (
        <p className={message.kind} role={message.kind === 'success' ? 'status' : 'alert'}>{message.text}</p>
      )}
      {run?.status === 'failed' && <p className="error" role="alert">The last assessment did not finish: {run.error}</p>}
      {run?.status === 'running' && !running && (
        <p className="error" role="alert">The last assessment stopped without finishing. Run it again.</p>
      )}

      {assessment && !running && (
        <div className={`hero tone-${head.tone}`}>
          {owner && (
            <div className="owner-said" role="status">
              <span className="hint">The owner decided · {fmtDate(owner.created_at)}</span>
              <strong className="big">{decisionText(owner)}</strong>
              {owner.reason && <p>&ldquo;{owner.reason}&rdquo;</p>}
              <span className="hint">{comparisonText(owner)}</span>
            </div>
          )}
          <p className="verdict-kicker">{owner ? 'CardScout suggested' : assessment.confirmed === false ? 'CardScout suggests' : 'Confirmed verdict'}</p>
          <h2 id="verdict-heading" className="verdict-title">{head.title}</h2>
          {learnedFrom && (
            <p className="learned-note">
              Learned from the owner: {decisionText(learnedFrom)} on {fmtDate(learnedFrom.created_at)}{learnedFrom.reason ? `, "${learnedFrom.reason}"` : ''}. <Link href="/settings#learned">Change in Settings</Link>
            </p>
          )}
        </div>
      )}

      <Tabs label="This card" tabs={[
        { id: 'decision', label: 'Decision', content: (
          <>
          {running ? (
        <section className="panel working" role="status">
          <p><strong>Working on it.</strong> Started {new Date(run.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })}, usually under a minute.</p>
          <p className="hint">You can start the next card; the verdict appears here on its own.</p>
          <RunWatcher startedAt={run.created_at} />
        </section>
      ) : assessment ? (
        <section className={`verdict tone-${head.tone}`} aria-label="Decision details">
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
          {run?.status === 'completed' && !run.price_guide?.found && run.price_guide?.options?.length > 0 && (
            <div className="pick-version">
              <h3>Which version is the card?</h3>
              <p className="hint">SportsCardsPro lists these for {offer.player} #{String(offer.card_number).replace(/^#/, '')}. Tap the one in your hand to get its price. CardScout does not guess, because versions can have very different prices.</p>
              <form action={pickVersion} className="chips">
                <input type="hidden" name="offer_id" value={offer.id} />
                {(() => {
                  const labels = versionLabels(run.price_guide.options);
                  return run.price_guide.options.map((o, i) => (
                    <button key={o.id} type="submit" name="product_id" value={o.id} className="chip">{labels[i]}</button>
                  ));
                })()}
              </form>
            </div>
          )}
          {holds.length > 0 && (
            <div className="holdups">
              <h3>{assessment.outcome === 'counteroffer' ? 'Why not the asking price' : assessment.outcome === 'decline' ? 'Why not' : 'What the owner needs to decide'}</h3>
              <ul>{holds.map((h, i) => <li key={i}>{h}</li>)}</ul>
            </div>
          )}
          {askOwner && (
            <div className="owner-ask">
              <h3>Owner&apos;s decision</h3>
              <OwnerDecision offerId={offer.id} remembered={remembered} suggestedOffer={suggestedOffer} />
            </div>
          )}
          {similar.filter((d) => d.id !== learnedFrom?.id).length > 0 && (
            <div className="before">
              <h3>The owner decided before</h3>
              <ul className="past-decisions">
                {similar.filter((d) => d.id !== learnedFrom?.id).map((d) => (
                  <li key={d.id} className={`d-${d.decision}`}>
                    <strong>{decisionText(d)}</strong> · <Link href={`/offers/${d.offer_id}`}>{d.player}, {[d.year, d.set_name, d.variant].filter(Boolean).join(' ')}</Link>
                    {d.asking_price_aud != null && <span className="hint"> · asked {aud.format(Number(d.asking_price_aud))}</span>}
                    {d.reason && <div>&ldquo;{d.reason}&rdquo;</div>}
                    <div className="hint">{d.why} · {fmtDate(d.created_at)}{compareWithSuggestion(d) === 'differed' ? ` · ${comparisonText(d)}` : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3>What makes this card worth it (or not)</h3>
          <dl className="why">
            {why.map((w) => <div key={w.label}><dt>{w.label}</dt><dd>{w.text}</dd></div>)}
          </dl>
          <div className="seller-line">
            <p className="hint">For the seller: &ldquo;{seller}&rdquo;</p>
          </div>
        </section>
      ) : (
        <section className="panel" aria-labelledby="ready-heading">
          <h2 id="ready-heading">Assess this card</h2>
          <p className="hint">CardScout finds the price, researches the player and applies the owner&apos;s rules. Nothing is bought.</p>
          {agentPanel}
        </section>
      )}
          </>
        ) },
        { id: 'workings', label: 'Workings', content: draft ? (
            <div className="draft">

            <p className="hint">
              Drafted {new Date(run.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} · {run.model} · {run.searches} search(es)
            </p>
            {steps.length > 0 ? (
              <ol className="steps">
                {steps.map((st) => (
                  <li key={st.key} className={`step step-${st.status}`}>
                    <div className="step-head">
                      <span className="step-n" aria-hidden="true">{st.n}</span>
                      <h3>{st.title}</h3>
                      <span className="step-chip">{STATUS_WORDS[st.status]}</span>
                    </div>
                    {st.facts && (
                      <p className="facts-line">
                        {st.facts.stage && <span className="stage-tag">{st.facts.stage}</span>}
                        {st.facts.line}
                        {st.facts.sources.length > 0 && <span className="hint"> · {st.facts.sources.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer nofollow">source {i + 1}</a>).reduce((x, y) => [x, ' ', y])}</span>}
                      </p>
                    )}
                    {st.note && <p className="field-error">{st.note}</p>}
                    {st.afterStop && <p className="hint">The card already stopped at step {st.afterStop}. This is shown so you can see the whole method.</p>}
                    {st.rows.length > 0 && (
                      <ul className="step-rows">
                        {st.rows.map((r) => (
                          <li key={r.label} className={`row-${r.status}`}>
                            <span className="row-mark" aria-hidden="true">{{ pass: '✓', stop: '✕', check: '?', info: '·', score: '' }[r.status]}</span>
                            <div>
                              {r.status === 'score' ? (
                                <>
                                  <div className="score-line">
                                    <strong>{r.label}</strong>
                                    <span className="score-num">{r.score}</span>
                                    <span className="hint">counts {r.weight}%</span>
                                  </div>
                                  <div className="score-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }} /></div>
                                </>
                              ) : (
                                <strong>{r.label}</strong>
                              )}
                              {r.text && <p>{r.text}</p>}
                              {r.sources?.length > 0 && (
                                <p className="hint">
                                  {r.sources.map((u, i) => (
                                    <a key={i} href={u} target="_blank" rel="noopener noreferrer nofollow">Source {i + 1}</a>
                                  )).reduce((x, y) => [x, ' · ', y])}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {st.maths?.length > 0 && (
                      <div className="maths" aria-label="The sum">
                        {st.maths.map((m, i) => <p key={i}>{m}</p>)}
                      </div>
                    )}
                    {st.result && <p className="step-result">{st.result}</p>}
                    {st.lesson && <p className="lesson"><strong>Why it matters:</strong> {st.lesson}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <>
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
                <h3>The owner&apos;s checks (AI suggestion, you confirm)</h3>
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
              </>
            )}
            {draft.questions_for_staff?.length > 0 && (
              <div className="before-confirm">
                <h3>Check before you confirm</h3>
                <ul>{draft.questions_for_staff.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
            <p className="evidence-link"><Link href={`/offers/${offer.id}/evidence`}>All the evidence and what the AI did →</Link></p>
          </div>
        ) : null },
        { id: 'change', label: assessment ? 'Change' : 'Manual', content: settings ? (
          <div className="change">
            {assessment && !running && (
              <>
                <h3 className="sub-h">Run the AI again</h3>
                <p className="hint">For example after changing the stock or condition, or to update the price fairness score.</p>
                {agentPanel}
                {!askOwner && (
                  <>
                    <h3 className="sub-h">{owner ? 'The owner changes his decision' : 'The owner decides differently'}</h3>
                    <OwnerDecision offerId={offer.id} remembered={remembered} suggestedOffer={suggestedOffer} current={owner} />
                  </>
                )}
                <h3 className="sub-h">Or change an answer or score yourself</h3>
              </>
            )}
            <p className="hint">
              Uses the owner&apos;s rules from <Link href="/settings">Owner settings</Link>
              {settings?.provisional ? ' (provisional values)' : ''}.
            </p>
            <AssessForm key={usedRun?.id ?? 'manual'} offerId={offer.id} salesWindowDays={settings.sales_window_days}
              initial={initial} agentRunId={usedRun?.id ?? null} keepRunId={!usedRun ? assessment?.agent_run_id ?? null : null} fromLast={fromLast} />
          </div>
        ) : (
          <p className="error" role="alert">Owner settings are missing. Run database/003_settings_assessments.sql in Supabase.</p>
        ) },
      ]} />

      {assessment && !running && (
        <div className="actionbar">
          {assessment.confirmed === false && !owner && !askOwner && (
            <form action={confirmVerdict} className="verdict-actions">
              <input type="hidden" name="offer_id" value={offer.id} />
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <button type="submit">Confirm</button>
              <span className="hint">Nothing is bought. Confirming records the decision.</span>
            </form>
          )}
          <CopyButton text={seller} />
        </div>
      )}

      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
