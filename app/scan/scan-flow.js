'use client';

import { useActionState, useRef, useState } from 'react';
import { scanCard } from './actions';
import OfferForm from '../offer-form';

const START = { status: 'idle', message: '', attempt: 0 };

// Shrinks a phone photo to at most 1280 px on the long side, so it uploads fast.
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoButton({ label, hint, value, onChange }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`photo${value ? ' has-photo' : ''}`}>
      <input type="file" accept="image/*" className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try { onChange(await shrink(file)); } catch { onChange(null); } finally { setBusy(false); }
        }} />
      {value ? <img src={value} alt="" /> : <span className="photo-icon" aria-hidden="true">📷</span>}
      <span className="photo-text">
        <strong>{busy ? 'Loading…' : value ? `${label} ✓ (tap to retake)` : label}</strong>
        {!value && hint && <span className="hint">{hint}</span>}
      </span>
    </label>
  );
}

export default function ScanFlow({ remembered }) {
  const [state, formAction, pending] = useActionState(scanCard, START);
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  // again: staff chose to scan another card after a result.
  const [again, setAgain] = useState(false);
  const done = state.status === 'success';
  const formKey = useRef(0);

  if (done && !again) {
    return (
      <>
        {state.note && <p className="notice">{state.note}</p>}
        <OfferForm
          key={`scan-${state.attempt}`}
          heading="Check the card"
          intro="CardScout read this from your photo. Check each field against the card, then type the asking price."
          initial={state.card}
          unsure={state.unsure ?? []}
          variants={state.variants ?? []}
        />
        <button type="button" className="secondary wide" onClick={() => { setFront(null); setBack(null); setAgain(true); formKey.current += 1; }}>
          Scan a different card
        </button>
      </>
    );
  }

  return (
    <>
      <section className="panel scan" aria-labelledby="scan-heading">
        <h2 id="scan-heading">Scan a card</h2>
        <p className="sub">Take a photo, or choose one you saved or screenshotted from a listing. Fill the photo with the card. The photo is only used to read the card and is not saved.</p>
        {state.status === 'error' && <p className="error" role="alert">{state.message}</p>}
        <form action={formAction} className="scan-form" onSubmit={() => setAgain(false)}>
          <PhotoButton label="Photo of the front" value={front} onChange={setFront} />
          <PhotoButton label="Photo of the back" hint="Optional. The card number is usually on the back." value={back} onChange={setBack} />
          <input type="hidden" name="front" value={front ?? ''} />
          <input type="hidden" name="back" value={back ?? ''} />
          {!remembered && (
            <div className="field">
              <label htmlFor="scan-passcode">Team passcode</label>
              <span className="hint">Asked once per device. It stops people outside the team using up the AI credit.</span>
              <input id="scan-passcode" name="passcode" type="password" autoComplete="off" />
            </div>
          )}
          <button type="submit" className="primary" disabled={!front || pending} aria-disabled={!front || pending}>
            {pending ? 'Reading the card…' : 'Read the card'}
          </button>
        </form>
      </section>
      <details className="fold">
        <summary>Type it in instead</summary>
        <OfferForm key={`again-${formKey.current}`} />
      </details>
    </>
  );
}
