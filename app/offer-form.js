'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { saveOffer } from './actions';

const START = { status: 'idle', message: '', errors: {}, values: {}, attempt: 0 };

const INPUTS = [
  { name: 'player', label: 'Player', hint: 'Full name as printed on the card', maxLength: 120, autoComplete: 'off' },
  { name: 'year', label: 'Year', hint: 'Four digits, for example 2024', inputMode: 'numeric', maxLength: 4 },
  { name: 'set_name', label: 'Set name', hint: 'For example Topps Chrome', maxLength: 120 },
  { name: 'card_number', label: 'Card number', hint: 'As printed, for example RC-12', maxLength: 40 },
  { name: 'variant', label: 'Variant', hint: 'For example Base, Refractor, Gold /50', maxLength: 80 },
  { name: 'grade_condition', label: 'Grade or condition', hint: 'As reported by the seller, for example PSA 10 or Ungraded', maxLength: 80 },
  { name: 'asking_price_aud', label: 'Asking price (AUD)', hint: 'Dollars only, up to 2 decimals, for example 95.50', inputMode: 'decimal' },
];

// initial: values read from a scan. unsure: fields the scan was not sure of. variants: versions from SportsCardsPro.
export default function OfferForm({ initial = {}, unsure = [], variants = [], heading = 'Add an offer', intro, photo = null }) {
  const [state, formAction, pending] = useActionState(saveOffer, START);
  const formRef = useRef(null);
  const [picked, setPicked] = useState(initial.variant ?? '');
  const messageRef = useRef(null);

  // After a failed save, move keyboard focus to the first field with a problem.
  // After a successful save, announce the message.
  useEffect(() => {
    if (state.status === 'error') {
      const first = INPUTS.find((f) => state.errors[f.name]);
      if (first) formRef.current?.elements[first.name]?.focus();
      else messageRef.current?.focus();
    } else if (state.status === 'success') {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <section className="panel" aria-labelledby="new-offer-heading">
      <h2 id="new-offer-heading">{heading}</h2>
      <p className="sub">{intro ?? 'Enter the card exactly as the seller describes it. Saving does not buy anything.'}</p>

      {state.message && (
        <p
          ref={messageRef}
          tabIndex={-1}
          className={state.status === 'success' ? 'success' : 'error'}
          role={state.status === 'success' ? 'status' : 'alert'}
        >
          {state.message}
        </p>
      )}

      {/* key changes on every attempt so typed values are put back after an error */}
      <form ref={formRef} action={formAction} key={state.attempt} noValidate className="offer-form">
        {/* The scan photo travels with the offer so it can be kept. */}
        {photo && <input type="hidden" name="photo" value={photo} />}
        {INPUTS.map((f) => {
          const error = state.errors[f.name];
          const hintId = `${f.name}-hint`;
          const errorId = `${f.name}-error`;
          return (
            <div key={f.name} className={`field${error ? ' has-error' : ''}`}>
              <label htmlFor={f.name}>
                {f.label}
                {unsure.includes(f.name) && <span className="check-tag">Check this</span>}
              </label>
              <span id={hintId} className="hint">{f.hint}</span>
              <input
                id={f.name}
                name={f.name}
                type="text"
                required
                defaultValue={state.values[f.name] ?? initial[f.name] ?? ''}
                autoFocus={f.name === 'asking_price_aud' && Object.keys(initial).length > 0}
                maxLength={f.maxLength}
                inputMode={f.inputMode}
                autoComplete={f.autoComplete ?? 'off'}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
              />
              {error && <span id={errorId} className="field-error">{error}</span>}
              {f.name === 'variant' && variants.length > 0 && (
                <div className="chips" role="group" aria-label="Versions SportsCardsPro lists for this card">
                  <span className="hint">Tap the version in your hand:</span>
                  {variants.map((v) => (
                    <button key={`${v.variant}|${v.set}`} type="button" className="chip" aria-pressed={picked === v.variant}
                      onClick={() => { const el = formRef.current?.elements.variant; if (el) el.value = v.variant; setPicked(v.variant); }}>
                      {v.variant}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? 'Saving…' : 'Save offer'}
        </button>
      </form>
    </section>
  );
}
