import Link from 'next/link';
import { cookies } from 'next/headers';
import { findPlayers } from '@/lib/players';
import { getLatestScout, getSkips, isScoutRunning } from '@/lib/scout-runs';
import { isRemembered } from '@/lib/agent-access';
import { scoutForMe } from './actions';
import PickCard from './pick-card';
import RunWatcher from '../offers/[id]/run-watcher';
import { hasFilters, positionLabel, RATINGS, ratingsApply, readFilters, shownRatings } from '@/lib/find-players.mjs';
import SearchForm from './search-form';
import Tabs from '../tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Find players · CardScout' };


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
    passcode: 'Wrong team passcode. Nothing was started.', limit: 'The scout has run its daily limit. Try again tomorrow.',
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

      <Tabs label="How to find players" initial={searched ? 'search' : 'scout'} tabs={[
        { id: 'scout', label: 'Scout for me', content: (
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
              <div className="field">
                <input name="focus" aria-label="Focus" placeholder="for example Korean players, or strikers" maxLength={120} />
              </div>
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
        ) },
        { id: 'search', label: 'Search yourself', content: (
          <>
      <SearchForm f={f} />

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
                  {ratingsApply(f.position) && (
                    <span className="offer-side ratings-mini">
                      {shownRatings(f.position).map((r) => <span key={r}>{RATINGS[r]} <strong>{p[r] ?? '–'}</strong></span>)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
          </>
        ) },
      ]} />
    </main>
  );
}
