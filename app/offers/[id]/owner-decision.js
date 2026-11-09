'use client';

import { useActionState, useState } from 'react';
import { decideOffer } from './actions';

const CHOICES = [['buy', 'Buy'], ['dont_buy', "Don't buy"], ['offer', 'Offer']];

// The owner taps Buy, Don't buy or Offer, adds a reason if he wants, and saves.
// Nothing is bought: this records what the owner decided, next to what CardScout suggested.
export default function OwnerDecision({ offerId, remembered = false, suggestedOffer = null, current = null }) {
  const [state, action, pending] = useActionState(decideOffer, {
    status: 'idle', errors: {}, attempt: 0,
    values: { decision: current?.decision ?? '', offer_aud: current?.offer_aud ?? suggestedOffer ?? '', reason: '' },
  });
  const [decision, setDecision] = useState(state.values?.decision ?? '');
  const err = state.errors ?? {};

  return (
    <form action={action} className="owner-decision" noValidate key={state.attempt}>
      <input type="hidden" name="offer_id" value={offerId} />
      <fieldset className={err.decision ? 'has-error' : undefined}>
        <legend className="sr-only">Your decision</legend>
        <div className="choice-row">
          {CHOICES.map(([value, label]) => (
            <label key={value} className={`choice choice-${value}${decision === value ? ' on' : ''}`}>
              <input type="radio" name="decision" value={value} defaultChecked={state.values?.decision === value}
                onChange={() => setDecision(value)} />
              {label}
            </label>
          ))}
        </div>
        {err.decision && <span className="field-error">{err.decision}</span>}
      </fieldset>
      {decision === 'offer' && (
        <div className={`field${err.offer_aud ? ' has-error' : ''}`}>
          <label htmlFor="owner_offer">How much to offer ($)</label>
          <input id="owner_offer" name="offer_aud" type="text" inputMode="decimal" autoComplete="off"
            defaultValue={state.values?.offer_aud ?? ''} aria-invalid={err.offer_aud ? 'true' : undefined} />
          {err.offer_aud && <span className="field-error">{err.offer_aud}</span>}
        </div>
      )}
      <div className={`field${err.reason ? ' has-error' : ''}`}>
        <label htmlFor="owner_reason">Why? <span className="hint">(optional, helps CardScout learn)</span></label>
        <input id="owner_reason" name="reason" type="text" maxLength={300} autoComplete="off"
          placeholder="for example he's just broken into the first team" defaultValue={state.values?.reason ?? ''} />
        {err.reason && <span className="field-error">{err.reason}</span>}
      </div>
      {!remembered && (
        <div className={`field${err.passcode ? ' has-error' : ''}`}>
          <label htmlFor="owner_passcode">Team passcode</label>
          <input id="owner_passcode" name="passcode" type="password" autoComplete="off" />
        </div>
      )}
      {state.status === 'error' && state.message && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="primary wide" disabled={pending || !decision}>{pending ? 'Saving…' : 'Save decision'}</button>
      <p className="hint">Nothing is bought. This records your decision so staff can tell the seller.</p>
    </form>
  );
}
