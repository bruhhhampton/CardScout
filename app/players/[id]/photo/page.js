import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';
import { positionLabel } from '@/lib/find-players.mjs';
import { candidatesFor, photoRow } from '@/lib/player-photos';
import { choosePlayerPhoto } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose photo · CardScout' };

// Staff pick which API-Football profile is this player. Used when the automatic match found
// nobody, several people, or the wrong person. The choice is never overwritten automatically.
export default async function ChoosePhoto({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!PLAYER_ID_PATTERN.test(id)) notFound();
  const { player } = await getPlayer(id);
  if (!player) notFound();
  const [{ candidates, error }, row] = await Promise.all([candidatesFor(player), photoRow(id)]);
  const Choice = ({ value, name, children, className = 'chip' }) => (
    <form action={choosePlayerPhoto}>
      <input type="hidden" name="player_id" value={id} />
      <input type="hidden" name="api_id" value={value} />
      <input type="hidden" name="api_name" value={name ?? ''} />
      <button type="submit" className={className}>{children}</button>
    </form>
  );
  return (
    <main>
      <p className="back"><Link href={`/players/${id}`}>← {player.name}</Link></p>
      <header className="appbar">
        <h1>Choose photo</h1>
        <p className="hint">{player.name} · {player.age_snapshot} · {player.club_snapshot} · {player.nationality} (from the game snapshot). Tap the profile that is him. Your choice is kept and never replaced automatically.</p>
      </header>
      {sp?.error && <p className="error" role="alert">{sp.error}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!error && candidates.length === 0 && <p className="empty">API-Football has no profile close to this name.</p>}
      {candidates.length > 0 && (
        <ul className="choose-list">
          {candidates.map((m) => (
            <li key={m.id}>
              {/* Shown straight from API-Football's image server; only the chosen one is saved. */}
              <img src={m.photo} alt="" width="56" height="56" loading="lazy" referrerPolicy="no-referrer" />
              <span className="row-body">
                <strong className="row-title">{m.name}</strong>
                <span className="row-sub">{[m.firstname && m.lastname ? `${m.firstname} ${m.lastname}` : null, m.age != null ? `age ${m.age}` : null, m.birth?.date ? `born ${m.birth.date}` : null, m.nationality, m.position].filter(Boolean).join(' · ')}</span>
                <span className="row-sub">{m.from}</span>
              </span>
              <Choice value={m.id} name={m.name}>This is him</Choice>
            </li>
          ))}
        </ul>
      )}
      <div className="choose-actions">
        <Choice value="none" className="chip quiet">None of these</Choice>
        {row?.chosen_by_person && <Choice value="auto" className="chip quiet">Let CardScout match him again</Choice>}
      </div>
      <p className="hint">{positionLabel(player.position)}. Photos from API-Football.</p>
    </main>
  );
}
