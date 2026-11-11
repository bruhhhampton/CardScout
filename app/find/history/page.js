import Link from 'next/link';
import { getSkips, listScouts } from '@/lib/scout-runs';
import { playersWithPhotos } from '@/lib/player-photos';
import { describeSearch, runFocus } from '@/lib/scout-checks.mjs';
import { undoNotForUs } from '../actions';
import PickCard from '../pick-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Past scouts · CardScout' };

const when = (d) => new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Every scout run: what it looked at, what it searched and who it picked, so nothing is missed.
export default async function PastScouts({ searchParams }) {
  const sp = await searchParams;
  const [{ runs, error }, skips] = await Promise.all([listScouts(20), getSkips()]);
  const skipped = new Set(skips.map((s) => s.player_id));
  const withPhoto = await playersWithPhotos(runs.flatMap((r) => (r.picks ?? []).map((p) => p.player_id)));
  return (
    <main>
      <p className="back"><Link href="/find">← Find</Link></p>
      <header className="appbar">
        <h1>Past scouts</h1>
        <p className="sub">The scout reads these too, so it does not repeat itself.</p>
      </header>
      {sp?.scout === 'skipped' && <p className="success" role="status">Got it. The scout will not suggest him again.</p>}
      {sp?.scout === 'undone' && <p className="success" role="status">Done. The scout may suggest him again.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!error && runs.length === 0 && <p className="empty">No scouts yet. Tap Scout for me on the Find tab.</p>}

      <ol className="scout-runs">
        {runs.map((r, i) => {
          const playerSearches = (r.trace ?? []).filter((t) => t.type === 'tool' && t.name === 'search_players' && t.input);
          const webSearches = (r.trace ?? []).filter((t) => t.type === 'search');
          const picks = (r.picks ?? []).filter((p) => !skipped.has(p.player_id));
          return (
            // One line per run; the newest starts open. How it searched is folded inside, for checking its work.
            <li key={r.id}>
              <details className="group scout-run" open={i === 0}>
                <summary>
                  <span><span className="run-when">{when(r.created_at)}</span><span className="run-focus">{runFocus(r)}</span></span>
                  <span className="group-count">{r.status === 'completed' ? `${picks.length} player${picks.length === 1 ? '' : 's'}` : r.status === 'running' ? 'Running' : 'Failed'}</span>
                </summary>
                {r.status === 'running' && <p className="hint">Still scouting…</p>}
                {r.status === 'failed' && <p className="field-error">Did not finish: {r.error}</p>}
                {r.status === 'completed' && (
                  <>
                    {picks.length === 0 ? <p className="empty">No picks to show.</p> : (
                      <ol className="picks">{picks.map((p) => <PickCard key={p.player_id} p={p} from="history" photo={withPhoto.has(p.player_id)} />)}</ol>
                    )}
                    {(playerSearches.length > 0 || webSearches.length > 0) && (
                      <details className="how-searched">
                        <summary>How it searched</summary>
                        {playerSearches.length > 0 && (
                          <p className="hint"><strong>Searched players:</strong> {playerSearches.map((t) => describeSearch(t.input)).join('; ')}</p>
                        )}
                        {webSearches.length > 0 && (
                          <p className="hint"><strong>Searched the web:</strong> {webSearches.map((t) => `“${t.query}”`).join(', ')}</p>
                        )}
                      </details>
                    )}
                  </>
                )}
              </details>
            </li>
          );
        })}
      </ol>

      {skips.length > 0 && (
        <section className="skips" aria-labelledby="skips-heading">
          <h2 id="skips-heading">Not for us</h2>
          <p className="hint">The scout never suggests these players.</p>
          <ul className="skip-list">
            {skips.map((s) => (
              <li key={s.player_id}>
                <Link href={`/players/${s.player_id}`}>{s.name || s.player_id}</Link>
                <form action={undoNotForUs}>
                  <input type="hidden" name="player_id" value={s.player_id} />
                  <button type="submit" className="chip quiet not-for-us">Undo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
