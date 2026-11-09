'use client';

import { useState } from 'react';

// Underlined tabs. Every panel stays on the page (only hidden), so forms keep what was typed
// and nothing about how they work changes.
export default function Tabs({ label, tabs, initial }) {
  const usable = tabs.filter((t) => t.content);
  const [on, setOn] = useState(usable.some((t) => t.id === initial) ? initial : usable[0]?.id);
  if (!usable.length) return null;
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist">
        {usable.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={on === t.id} aria-controls={`panel-${t.id}`}
            className={`tabbtn${on === t.id ? ' on' : ''}`} onClick={() => setOn(t.id)}>{t.label}</button>
        ))}
      </div>
      {usable.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={on !== t.id} className="tabpanel">{t.content}</div>
      ))}
    </div>
  );
}
