'use client';

import { useActionState, useEffect, useRef } from 'react';
import { SCORE_FIELDS } from '@/lib/assessment-fields';
import { assessOffer } from './actions';

const ORDER = ['stock_count', 'condition', 'sales_count', 'median_sold_aud', 'evidence_source', ...SCORE_FIELDS.map((f) => f.name)];

function Field({ name, label, hint, state, children, inputMode }) {
  const err = state.errors[name];
  const describedBy = [hint && `${name}-hint`, err && `${name}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${err ? ' has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {hint && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {children ?? (
        <input id={name} name={name} type="text" inputMode={inputMode} autoComplete="off"
          defaultValue={state.values[name] ?? ''} aria-invalid={err ? 'true' : undefined} aria-describedby={describedBy} />
      )}
      {err && <span id={`${name}-error`} className="field-error">{err}</span>}
    </div>
  );
}

export default function AssessForm({ offerId, salesWindowDays }) {
  const [state, formAction, pending] = useActionState(assessOffer, {
    status: 'idle', message: '', errors: {}, values: {}, attempt: 0,
  });
  const formRef = useRef(null);
  const msgRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error') {
      const first = ORDER.find((n) => state.errors[n]);
      if (first) formRef.current?.elements[first]?.focus();
      else msgRef.current?.focus();
    }
  }, [state]);

  const condErr = state.errors.condition;
  return (
    <>
      {state.status === 'error' && state.message && (
        <p ref={msgRef} tabIndex={-1} className="error" role="alert">{state.message}</p>
      )}
      <form ref={formRef} action={formAction} key={state.attempt} noValidate className="offer-form">
        <input type="hidden" name="offer_id" value={offerId} />
        <Field name="stock_count" label="Copies already in stock" hint="Count the shop's copies of this exact card" state={state} inputMode="numeric" />
        <Field name="condition" label="Condition after inspection" state={state}>
          <select id="condition" name="condition" defaultValue={state.values.condition ?? ''}
            aria-invalid={condErr ? 'true' : undefined} aria-describedby={condErr ? 'condition-error' : undefined}>
            <option value="" disabled>Choose…</option>
            <option value="acceptable">Meets the standard</option>
            <option value="not_acceptable">Does not meet the standard</option>
            <option value="unsure">Not sure yet</option>
          </select>
        </Field>
        <Field name="sales_count" label={`Matching sold sales in the last ${salesWindowDays} days`}
          hint="Same player, set, number, variant and grade. Sold prices only, not asking prices." state={state} inputMode="numeric" />
        <Field name="median_sold_aud" label="Middle sold price (AUD)" hint="The median of those sales. Leave blank if there are none." state={state} inputMode="decimal" />
        <Field name="evidence_source" label="Where the sales came from" hint="Links or a short note, so the owner can check" state={state} />
        {SCORE_FIELDS.map((f) => (
          <Field key={f.name} name={f.name} label={`${f.label} (0 to 100)`} hint={f.hint} state={state} inputMode="numeric" />
        ))}
        <button type="submit" disabled={pending}>{pending ? 'Assessing…' : 'Run assessment'}</button>
      </form>
    </>
  );
}
