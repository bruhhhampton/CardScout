'use client';

import { useState } from 'react';
import { POSITIONS, RATINGS, ratingsApply, shownRatings, SORT_LABEL, sortsFor } from '@/lib/find-players.mjs';

const RATING = Array.from({ length: 20 }, (_, i) => 20 - i);

// "Search yourself": the rating boxes change with the position, so each shows what matters for it.
export default function SearchForm({ f }) {
  const [position, setPosition] = useState(f.position ?? '');
  const shown = shownRatings(position);
  return (
    <form method="get" className="panel find-form">
      <div className="find-grid">
        <div className="field">
          <label htmlFor="position">Position</label>
          <select id="position" name="position" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">Any</option>
            {Object.entries(POSITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="max_age">Age up to</label>
          <input id="max_age" name="max_age" inputMode="numeric" defaultValue={f.maxAge ?? ''} placeholder="for example 21" />
        </div>
        {shown.map((r) => (
          <div className="field" key={`${position}-${r}`}>
            <label htmlFor={`min_${r}`}>{RATINGS[r]} at least</label>
            <select id={`min_${r}`} name={`min_${r}`} defaultValue={position === f.position ? (f.mins?.[r] ?? '') : ''}>
              <option value="">Any</option>
              {RATING.map((n) => <option key={n} value={n}>{n} / 20</option>)}
            </select>
          </div>
        ))}
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
          <select id="sort" name="sort" key={position} defaultValue={position === f.position ? f.sort : sortsFor(position)[0]}>
            {sortsFor(position).map((k) => <option key={k} value={k}>{SORT_LABEL(k)}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="primary wide">Find players</button>
      <p className="hint">
        {ratingsApply(position)
          ? 'Game ratings out of 20 from a Football Manager 26 snapshot, chosen for this position. They help find players and are never used in a verdict. Clubs and ages may be out of date.'
          : 'There are no goalkeeping ratings in the data, so goalkeepers are found by age, nationality and club. Clubs and ages may be out of date.'}
      </p>
    </form>
  );
}
