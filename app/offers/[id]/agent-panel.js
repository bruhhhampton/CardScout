'use client';

import { useActionState, useEffect, useRef } from 'react';
import { forgetPasscode, prepareDraft } from './actions';

const START = { status: 'idle', message: '', errors: {}, notes: '', values: {}, attempt: 0 };

// One click prepares the AI draft and the verdict. Staff first enter the two things only a
// person can know: copies in stock and the card's condition.
export default function AgentPanel({ offerId, remembered = false, initial = {}, soldSearchUrl = null, priceSiteUrl = null }) {
  const [state, formAction, pending] = useActionState(prepareDraft, { ...START, values: initial });
  const formRef = useRef(null);
  const msgRef = useRef(null);
  useEffect(() => {
    if (state.status === 'error') {
      const first = ['stock_count', 'condition', 'sales_link'].find((n) => state.errors?.[n]);
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
              defaultValue={state.values?.stock_count || '0'} aria-invalid={err.stock_count ? 'true' : undefined}
              aria-describedby={err.stock_count ? 'agent_stock-hint agent_stock-error' : 'agent_stock-hint'} />
            {err.stock_count && <span id="agent_stock-error" className="field-error">{err.stock_count}</span>}
          </div>
          <div className={`field${err.condition ? ' has-error' : ''}`}>
            <label htmlFor="agent_condition">Condition</label>
            <span id="agent_condition-hint" className="hint">From the card or the seller&apos;s photos. Change it if you see flaws.</span>
            <select id="agent_condition" name="condition" defaultValue={state.values?.condition || 'acceptable'}
              aria-invalid={err.condition ? 'true' : undefined}
              aria-describedby={err.condition ? 'agent_condition-hint agent_condition-error' : 'agent_condition-hint'}>
              <option value="" disabled>Choose…</option>
              <option value="acceptable">Meets the standard</option>
              <option value="not_acceptable">Does not meet the standard</option>
              <option value="unsure">Not sure yet</option>
            </select>
            {err.condition && <span id="agent_condition-error" className="field-error">{err.condition}</span>}
          </div>
          <div className="field">
            <label htmlFor="agent_rookie">Rookie card?</label>
            <span id="agent_rookie-hint" className="hint">Look for the RC logo on the card or in the seller&apos;s photos</span>
            <select id="agent_rookie" name="rookie_card" defaultValue={state.values?.rookie_card ?? ''} aria-describedby="agent_rookie-hint">
              <option value="">Let the AI check</option>
              <option value="yes">Yes, it has the RC logo</option>
              <option value="no">No, it is not a rookie card</option>
            </select>
          </div>
        </div>
        <fieldset className="sales-paste">
          <legend>Sales you found (optional)</legend>
          <p className="hint">
            {soldSearchUrl && (
              <><a href={soldSearchUrl} target="_blank" rel="noopener noreferrer">Find sold sales on eBay Australia ↗</a><br /></>
            )}
            {priceSiteUrl && (
              <><a href={priceSiteUrl} target="_blank" rel="noopener noreferrer">Find sold sales on SportsCardsPro ↗</a>{' '}
              (open the exact card, then scroll to its sold listings)<br /></>
            )}
            Copy the page address from your browser bar, pick the currency the prices are shown in, and paste the sale rows exactly as copied.
            You do not need to write anything else: CardScout writes the explanation for the AI.
          </p>
          <div className="two">
            <div className={`field${err.sales_link ? ' has-error' : ''}`}>
              <label htmlFor="sales_link">Page address</label>
              <input id="sales_link" name="sales_link" type="url" autoComplete="off" placeholder="https://…"
                defaultValue={state.values?.sales_link ?? ''} aria-invalid={err.sales_link ? 'true' : undefined}
                aria-describedby={err.sales_link ? 'sales_link-error' : undefined} />
              {err.sales_link && <span id="sales_link-error" className="field-error">{err.sales_link}</span>}
            </div>
            <div className="field">
              <label htmlFor="sales_currency">Prices are shown in</label>
              <select id="sales_currency" name="sales_currency" defaultValue={state.values?.sales_currency ?? 'AUD'}>
                <option value="AUD">AUD (Australian sales)</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="sales_rows">Sale rows</label>
            <span id="sales_rows-hint" className="hint">Copy 5 to 10 recent rows (date, title, price) and paste them here.</span>
            <textarea id="sales_rows" name="sales_rows" rows={5} maxLength={3000} defaultValue={state.values?.sales_rows ?? ''}
              aria-describedby="sales_rows-hint" />
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="staff_notes">Anything else the AI should know (optional)</label>
          <textarea id="staff_notes" name="staff_notes" rows={2} maxLength={1000} defaultValue={state.notes} />
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
          {pending ? 'Starting…' : 'Prepare draft and assess'}
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
