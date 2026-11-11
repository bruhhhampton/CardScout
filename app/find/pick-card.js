import Link from 'next/link';
import { notForUs } from './actions';
import { positionLabel } from '@/lib/find-players.mjs';

const scanLink = (c) => `/scan?${new URLSearchParams({ player: c.player, year: c.year, set_name: c.set_name, card_number: c.card_number, variant: c.variant })}`;

// One scout pick: who, why (with sources), and what staff can do next. Used on Find and Past scouts.
// A small photo shows only when one was already found for this player (see lib/player-photos.js).
export default function PickCard({ p, from = 'find', photo = false }) {
  return (
    <li className={`pick${photo ? ' with-photo' : ''}`}>
      {photo && <img className="pick-photo" src={`/player-photo/${p.player_id}`} alt="" width="44" height="44" loading="lazy" />}
      <div className="pick-body">
        <Link href={`/players/${p.player_id}`} className="pick-name">{p.name}</Link>
        <span className="row-sub">{p.age} · {p.club}{p.position ? ` · ${positionLabel(p.position)}` : ''}</span>
        <p className="pick-why">{p.why}</p>
        {p.checked ? (
          <p className="hint">Sources: {p.sources.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer nofollow">{i + 1}</a>).reduce((x, y) => [x, ' ', y])}</p>
        ) : (
          <p className="field-error">No source found for this, so check his form before buying.</p>
        )}
        <div className="pick-actions">
          {p.card && <Link href={scanLink(p.card)} className="chip">Assess #{p.card.card_number}{p.card.variant !== 'Base' ? ` ${p.card.variant}` : ''}{p.card.hot ? ' · Hot' : ''}</Link>}
          <Link href={`/players/${p.player_id}`} className="chip quiet">His cards</Link>
          <form action={notForUs}>
            <input type="hidden" name="player_id" value={p.player_id} />
            <input type="hidden" name="name" value={p.name} />
            <input type="hidden" name="from" value={from} />
            <button type="submit" className="chip quiet not-for-us">Not for us</button>
          </form>
        </div>
      </div>
    </li>
  );
}
