import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS, DEFENDING_GROUP, getPlayer, PLAYER_ID_PATTERN } from '@/lib/players';
import { positionLabel, similarQuery } from '@/lib/find-players.mjs';
import { playerCards } from '@/lib/price-guide';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Player · CardScout' };

const scanLink = (c) => `/scan?${new URLSearchParams({ player: c.player, year: c.year, set_name: c.set_name, card_number: c.card_number, variant: c.variant })}`;

// A player found in Find players: who he is (game ratings, for context only) and which of his cards exist.
export default async function PlayerPage({ params }) {
  const { id } = await params;
  if (!PLAYER_ID_PATTERN.test(id)) notFound();
  const { player, error } = await getPlayer(id);
  if (!player) {
    if (error) return <main><p className="error" role="alert">{error}</p></main>;
    notFound();
  }
  const { cards, reason } = await playerCards(player.name);

  return (
    <main>
      <p className="back"><Link href="/find">← Find players</Link></p>
      <header className="appbar">
        <h1>{player.name}</h1>
        <p className="sub">{positionLabel(player.position)}</p>
        <p className="hint">{player.age_snapshot} · {player.club_snapshot} · {player.nationality} (from the game snapshot; may be out of date)</p>
        <p><Link href={`/find?${similarQuery(player)}`} className="chip">More like him</Link></p>
      </header>

      <section className="panel" aria-labelledby="cards-heading">
        <h2 id="cards-heading">His cards</h2>
        {reason && <p className="hint">{reason}</p>}
        {!reason && cards.length === 0 && <p className="empty">SportsCardsPro lists no cards under this exact name.</p>}
        {cards.length > 0 && (
          <ul className="card-rows">
            {cards.map((c) => (
              <li key={c.id}>
                <span>
                  {(c.hot || c.rookie_year) && (
                    <span className="card-tags">
                      {c.hot && <span className="tag hot">🔥 Hot</span>}
                      {c.rookie_year && <span className="tag rookie">⭐ Rookie year</span>}
                    </span>
                  )}
                  <strong>{c.title}</strong>
                  {(c.loose_usd != null || c.sales_per_year != null) && (
                    <span className="hint">{[c.loose_usd != null && `About US$${c.loose_usd.toFixed(2)} ungraded`, c.sales_per_year != null && `${c.sales_per_year} sold a year`].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <Link href={scanLink(c)} className="chip">Assess this card</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Best first. 🔥 Hot: his most-sold cards, with at least 20 sold a year on SportsCardsPro. ⭐ Rookie year: his first season, which collectors want most. Assessing a card checks his real form and the owner&apos;s rules before anything is bought.</p>
      </section>

      <section className="panel" aria-labelledby="ratings-heading">
        <h2 id="ratings-heading">Game ratings (for context only)</h2>
        {/^GK/i.test(String(player.position ?? '')) && (
          <p className="hint">There are no goalkeeping ratings (handling, reflexes) in the data, so judge him on his real form.</p>
        )}
        {[...ATTRIBUTE_GROUPS, ...(player.tackling != null ? [DEFENDING_GROUP] : [])].map((g) => (
          <div key={g.label} className="attr-group">
            <h3>{g.label}</h3>
            <ul className="attrs">
              {g.keys.map((k) => (
                <li key={k}>
                  <span>{ATTRIBUTE_LABELS[k]}</span>
                  <span className="mini-bar" aria-hidden="true"><span style={{ width: `${(Number(player[k]) / 20) * 100}%` }} /></span>
                  <strong>{player[k]}</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="hint">Football Manager 26 ratings out of 20, from a community dataset ({player.source}). They show what kind of player he is. They are never used to value a card or decide a buy.</p>
      </section>
    </main>
  );
}
