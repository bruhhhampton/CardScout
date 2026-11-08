import Link from 'next/link';
import { cookies } from 'next/headers';
import { findPlayers } from '@/lib/players';
import { getLatestScout, getSkips, isScoutRunning } from '@/lib/scout-runs';
import { isRemembered } from '@/lib/agent-access';
import { scoutForMe } from './actions';
import PickCard from './pick-card';
import RunWatcher from '../offers/[id]/run-watcher';
import { hasFilters, isDefensive, POSITIONS, positionLabel, ratingsApply, readFilters, SORTS } from '@/lib/find-players.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find players · CardScout' };

const RATING = Array.from({ length: 20 }, (_, i) => 20 - i);

// Find promising players the shop cannot watch, using Football Manager game ratings.
// The ratings only shortlist players. Real stats and real prices decide whether to buy.
export default async function FindPage({ searchParams }) {
  const sp = await searchParams;
  const f = readFilters(sp ?? {});
  const searched = hasFilters(f);
  const [{ players, error }, { run: scout, missing }, jar, skips] = await Promise.all([
    searched ? findPlayers(f) : Promise.resolve({ players: [], error: null }),
    getLatestScout(),
    cookies(),
    getSkips(),
  ]);
  const skippedIds = new Set(skips.map((s) => s.player_id));
  const scouting = isScoutRunning(scout);
  const remembered = isRemembered(jar);
  const MSG = {
    passcode: 'Wrong team passcode. Nothing was started.', running: 'The scout is already working.', limit: 'The scout has run its daily limit. Try again tomorrow.',
    'skip-failed': 'Not saved. Run database/014_scout_memory.sql in Supabase first.',
    setup: missing ? 'Run database/013_scout_runs.sql in Supabase first.' : 'The scout could not be started. Try again.', off: 'Scouting is not set up on the server yet.',
  };
  const note = MSG[sp?.scout];
  const done = sp?.scout === 'skipped' ? 'Got it. The scout will not suggest him again.' : null;

  return (
    <main>
      <header className="appbar">
        <h1>Find players</h1>
        <p className="sub">Players worth watching in leagues the shop cannot follow.</p>
      </header>

      <section className="panel scout" aria-labelledby="scout-heading">
        <h2 id="scout-heading">Scout for me</h2>
        <p className="sub">One tap. CardScout looks for young players worth watching, checks their real form this season and finds their cards. Nothing is bought.</p>
        {note && <p className="error" role="alert">{note}</p>}
        {done && <p className="success" role="status">{done}</p>}
        {scouting ? (
          <div className="working">
            <p><strong>Scouting…</strong> usually about a minute. You can leave this page and come back.</p>
            <RunWatcher startedAt={scout.created_at} />
          </div>
        ) : (
          <form action={scoutForMe} className="scout-form">
            {!remembered && (
              <div className="field">
                <label htmlFor="scout-passcode">Team passcode</label>
                <input id="scout-passcode" name="passcode" type="password" autoComplete="off" />
              </div>
            )}
            <details className="extra">
              <summary>Focus on something (optional)</summary>
              <input name="focus" aria-label="Focus" placeholder="for example Korean players, or strikers" maxLength={120} />
            </details>
            <button type="submit" className="primary wide">{scout?.status === 'completed' ? 'Scout again' : 'Scout for me'}</button>
          </form>
        )}
        {!scouting && scout?.status === 'failed' && <p className="error">The last scout did not finish: {scout.error}</p>}
        {!scouting && scout?.status === 'completed' && (
          <>
            <p className="hint">Scouted {new Date(scout.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })}. {scout.summary}</p>
            {scout.picks.length === 0 && <p className="empty">No players passed the real-form check this time. Try again with a focus.</p>}
            <ol className="picks">
              {scout.picks.filter((p) => !skippedIds.has(p.player_id)).map((p) => <PickCard key={p.player_id} p={p} />)}
            </ol>
          </>
        )}
        <p className="past-link"><Link href="/find/history">Past scouts →</Link></p>
      </section>

      <details className="fold" open={searched || undefined}>
        <summary>Search yourself</summary>
      <form method="get" className="panel find-form">
        <div className="find-grid">
          <div className="field">
            <label htmlFor="position">Position</label>
            <select id="position" name="position" defaultValue={f.position}>
              <option value="">Any</option>
              {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}{ratingsApply(k) ? '' : ' (age, nationality, club only)'}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="max_age">Age up to</label>
            <input id="max_age" name="max_age" inputMode="numeric" defaultValue={f.maxAge ?? ''} placeholder="for example 21" />
          </div>
          <div className="field">
            <label htmlFor="min_pace">Pace at least</label>
            <select id="min_pace" name="min_pace" defaultValue={f.minPace ?? ''}>
              <option value="">Any</option>
              {RATING.map((n) => <option key={n} value={n}>{n} / 20</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="min_finishing">Finishing at least</label>
            <select id="min_finishing" name="min_finishing" defaultValue={f.minFinishing ?? ''}>
              <option value="">Any</option>
              {RATING.map((n) => <option key={n} value={n}>{n} / 20</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="min_tackling">Tackling at least</label>
            <select id="min_tackling" name="min_tackling" defaultValue={f.minTackling ?? ''}>
              <option value="">Any</option>
              {RATING.map((n) => <option key={n} value={n}>{n} / 20</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="min_heading">Heading at least</label>
            <select id="min_heading" name="min_heading" defaultValue={f.minHeading ?? ''}>
              <option value="">Any</option>
              {RATING.map((n) => <option key={n} value={n}>{n} / 20</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nationality">Nationality</label>
            <input id="nationality" name="nationality" defaultValue={f.nationality} placeholder="for example Korea" />
          </div>
          <div className="field">
            <label htmlFor="club">Club</label>
            <input id="club" name="club" defaultValue={f.club} placeholder="for example Ulsan" />
          </div>
          <div className="field">
            <label htmlFor="sort">Best first by</label>
            <select id="sort" name="sort" defaultValue={f.sort}>
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="primary wide">Find players</button>
        <p className="hint">Game ratings from a Football Manager 26 snapshot, out of 20. There are no goalkeeping ratings, so goalkeepers are searched by age, nationality and club only. Use tackling and heading for defenders. They help find players and are never used in a verdict. Clubs and ages may be out of date.</p>
      </form>
      </details>

      {error && <p className="error" role="alert">{error}</p>}
      {searched && !error && (
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="list-heading">{players.length ? `${players.length === 30 ? 'Top 30' : players.length} player${players.length === 1 ? '' : 's'}` : 'No players match'}</h2>
          {players.length === 0 && <p className="empty">Try fewer filters or lower ratings.</p>}
          {!ratingsApply(f.position) && players.length > 0 && <p className="hint">Youngest first. There are no goalkeeping ratings in the data, so none are shown.</p>}
          <ul className="offer-rows">
            {players.map((p) => (
              <li key={p.player_id}>
                <Link href={`/players/${p.player_id}`} className="offer-row">
                  <span className="offer-main">
                    <strong>{p.name}</strong>
                    <span className="hint">{p.age_snapshot} · {p.club_snapshot} · {p.nationality}</span>
                    <span className="hint">{positionLabel(p.position)}</span>
                  </span>
                  {ratingsApply(f.position) && (isDefensive(f.position) && p.tackling != null ? (
                    <span className="offer-side ratings-mini">
                      <span>Tackling <strong>{p.tackling}</strong></span>
                      <span>Heading <strong>{p.heading}</strong></span>
                    </span>
                  ) : (
                    <span className="offer-side ratings-mini">
                      <span>Pace <strong>{p.pace}</strong></span>
                      <span>Finishing <strong>{p.finishing}</strong></span>
                    </span>
                  ))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
