'use client';

import { useActionState, useEffect, useRef } from 'react';
import { GATE_FIELDS, SCORE_FIELDS } from '@/lib/assessment-fields';
import { assessOffer } from './actions';

const EVIDENCE = ['sales_count', 'median_sold_aud', 'evidence_source', ...SCORE_FIELDS.map((f) => f.name)];
const ORDER = ['stock_count', 'condition', 'rookie_card', 'first_team', 'sales_count', 'median_sold_aud', 'evidence_source', ...SCORE_FIELDS.map((f) => f.name)];

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

export default function AssessForm({ offerId, salesWindowDays, initial = {}, agentRunId = null, keepRunId = null, fromLast = false }) {
  const [state, formAction, pending] = useActionState(assessOffer, {
    status: 'idle', message: '', errors: {}, values: initial, attempt: 0,
  });
  const formRef = useRef(null);
  const msgRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error') {
      const first = ORDER.find((n) => state.errors[n]);
      if (first) {
        const el = formRef.current?.elements[first];
        const box = el?.closest('details');
        if (box) box.open = true;
        el?.focus();
      }
      else msgRef.current?.focus();
    }
  }, [state]);

  const condErr = state.errors.condition;
  // When the evidence is already filled in (from the AI draft or the last assessment), show it as a
  // one-line summary that staff can open to edit, so they only fill in what needs a person.
  const prefilled = Boolean(agentRunId || fromLast) && String(state.values.sales_count ?? '') !== '';
  const evidenceError = EVIDENCE.some((n) => state.errors[n]);
  const v = state.values;
  const summary = `${v.sales_count} sale(s)${v.median_sold_aud ? `, median $${Number(v.median_sold_aud).toFixed(2)}` : ''} · scores ${SCORE_FIELDS.map((f) => v[f.name] || '–').join(' / ')}`;
  const evidenceFields = (
    <>
      <Field name="sales_count" label={`Matching sold sales in the last ${salesWindowDays} days`}
        hint="Same player, set, number, variant and grade. Sold prices only, not asking prices." state={state} inputMode="numeric" />
      <Field name="median_sold_aud" label="Middle sold price (AUD)" hint="The median of those sales. Leave blank if there are none." state={state} inputMode="decimal" />
      <Field name="evidence_source" label="Where the sales came from" hint="Links or a short note, so the owner can check" state={state} />
      {SCORE_FIELDS.map((f) => (
        <Field key={f.name} name={f.name} label={`${f.formLabel ?? f.label} (0 to 100)`} hint={f.hint} state={state} inputMode="numeric" />
      ))}
    </>
  );
  return (
    <>
      {state.status === 'error' && state.message && (
        <p ref={msgRef} tabIndex={-1} className="error" role="alert">{state.message}</p>
      )}
      <form ref={formRef} action={formAction} key={state.attempt} noValidate className="offer-form">
        <input type="hidden" name="offer_id" value={offerId} />
        {(agentRunId || keepRunId) && <input type="hidden" name="agent_run_id" value={agentRunId || keepRunId} />}
        {agentRunId && (
          <p className="notice">Sales, scores and Cerf&apos;s two checks come from the AI draft above. Confirm the two checks, add stock and condition, then run it.</p>
        )}
        {fromLast && (
          <p className="notice">Filled in from the last assessment. Change anything that has changed, then run it again.</p>
        )}
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
        {GATE_FIELDS.map((g) => {
          const err = state.errors[g.name];
          return (
            <Field key={g.name} name={g.name} label={g.label} hint={g.hint} state={state}>
              <select id={g.name} name={g.name} defaultValue={state.values[g.name] ?? ''}
                aria-invalid={err ? 'true' : undefined}
                aria-describedby={[`${g.name}-hint`, err && `${g.name}-error`].filter(Boolean).join(' ')}>
                <option value="" disabled>Choose…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unsure">Not sure</option>
              </select>
            </Field>
          );
        })}
        {prefilled ? (
          <details className="prefill" open={evidenceError}>
            <summary>{agentRunId ? 'From the AI draft' : 'From the last assessment'}: {summary} · Edit</summary>
            <div className="prefill-fields">{evidenceFields}</div>
          </details>
        ) : evidenceFields}
        <button type="submit" disabled={pending}>{pending ? 'Assessing…' : 'Run assessment'}</button>
      </form>
    </>
  );
}
