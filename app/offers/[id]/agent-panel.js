'use client';

import { useActionState, useEffect, useRef } from 'react';
import { forgetPasscode, prepareDraft } from './actions';

const START = { status: 'idle', message: '', errors: {}, notes: '', values: {}, attempt: 0 };

// One click prepares the AI draft and the verdict. Staff first enter the two things only a
// person can know: copies in stock and the card's condition.
export default function AgentPanel({ offerId, remembered = false, initial = {}, soldSearchUrl = null }) {
  const [state, formAction, pending] = useActionState(prepareDraft, { ...START, values: initial });
  const formRef = useRef(null);
  const msgRef = useRef(null);
  useEffect(() => {
    if (state.status === 'error') {
      const first = ['stock_count', 'condition'].find((n) => state.errors?.[n]);
      if (first) formRef.current?.elements[first]?.focus();
      else msgRef.current?.focus();
    } else if (state.message) msgRef.current?.focus();
  }, [state]);
  const err = state.errors ?? {};

  return (
    <>
      <form ref={formRef} action={formAction} key={state.attempt} noValidate className="agent-form">
        <input type="hidden" name="offer_id" value={offerId} />
        <div className="two">
          <div className={`field${err.stock_count ? ' has-error' : ''}`}>
            <label htmlFor="agent_stock">Copies already in stock</label>
            <span id="agent_stock-hint" className="hint">Count the shop&apos;s copies of this exact card</span>
            <input id="agent_stock" name="stock_count" type="text" inputMode="numeric" autoComplete="off"
              defaultValue={state.values?.stock_count ?? ''} aria-invalid={err.stock_count ? 'true' : undefined}
              aria-describedby={err.stock_count ? 'agent_stock-hint agent_stock-error' : 'agent_stock-hint'} />
            {err.stock_count && <span id="agent_stock-error" className="field-error">{err.stock_count}</span>}
          </div>
          <div className={`field${err.condition ? ' has-error' : ''}`}>
            <label htmlFor="agent_condition">Condition</label>
            <span id="agent_condition-hint" className="hint">From the card or the seller&apos;s photos</span>
            <select id="agent_condition" name="condition" defaultValue={state.values?.condition ?? ''}
              aria-invalid={err.condition ? 'true' : undefined}
              aria-describedby={err.condition ? 'agent_condition-hint agent_condition-error' : 'agent_condition-hint'}>
              <option value="" disabled>Choose…</option>
              <option value="acceptable">Meets the standard</option>
              <option value="not_acceptable">Does not meet the standard</option>
              <option value="unsure">Not sure yet</option>
            </select>
            {err.condition && <span id="agent_condition-error" className="field-error">{err.condition}</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="staff_notes">Notes for the AI (optional)</label>
          <span id="staff_notes-hint" className="hint">
            Paste any sold listing links you found, or anything the AI should know. It can only use links it found itself or that you paste here.
          </span>
          {soldSearchUrl && (
            <p className="hint">
              <a href={soldSearchUrl} target="_blank" rel="noopener noreferrer">Find sold sales on eBay Australia ↗</a>{' '}
              opens eBay already filtered to sold items from Australian sellers, newest first. Copy the links of matching sales here,
              with the price and date. If nothing shows, shorten the search on eBay.
            </p>
          )}
          <textarea id="staff_notes" name="staff_notes" rows={3} maxLength={4000} defaultValue={state.notes}
            aria-describedby="staff_notes-hint" />
        </div>
        {!remembered && (
          <div className="field">
            <label htmlFor="passcode">Team passcode</label>
            <span id="passcode-hint" className="hint">Stops people outside the team using up the AI credit.</span>
            <input id="passcode" name="passcode" type="password" autoComplete="off" required aria-describedby="passcode-hint" />
            <label className="check">
              <input type="checkbox" name="remember" defaultChecked /> Remember on this device for 30 days
            </label>
          </div>
        )}
        {state.message && (
          <p ref={msgRef} tabIndex={-1} className={state.status === 'success' ? 'success' : 'error'}
            role={state.status === 'success' ? 'status' : 'alert'}>{state.message}</p>
        )}
        <button type="submit" disabled={pending}>
          {pending ? 'Researching and assessing… this can take up to a minute' : 'Prepare draft and assess'}
        </button>
      </form>
      {remembered && (
        <form action={forgetPasscode} className="remembered">
          <input type="hidden" name="offer_id" value={offerId} />
          <span className="hint">Team passcode remembered on this device.</span>{' '}
          <button type="submit" className="linkbtn">Forget it</button>
        </form>
      )}
    </>
  );
}
