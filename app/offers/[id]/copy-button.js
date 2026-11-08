'use client';

import { useState } from 'react';

// Copies the seller message in one tap, so it does not need its own dropdown.
export default function CopyButton({ text, label = 'Copy message for seller' }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="secondary copy-btn"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
      }}>
      {done ? 'Copied' : label}
    </button>
  );
}
