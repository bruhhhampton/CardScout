'use client';

import { useActionState, useEffect, useRef } from 'react';
import { prepareDraft } from './actions';

export default function AgentPanel({ offerId }) {
  const [state, formAction, pending] = useActionState(prepareDraft, { status: 'idle', message: '', notes: '', attempt: 0 });
  const msgRef = useRef(null);
  useEffect(() => { if (state.message) msgRef.current?.focus(); }, [state]);
  return (
    <form action={formAction} key={state.attempt} className="agent-form">
      <input type="hidden" name="offer_id" value={offerId} />
      <div className="field">
        <label htmlFor="staff_notes">Notes for the AI (optional)</label>
        <span id="staff_notes-hint" className="hint">
          Paste any sold listing links you found, or anything the AI should know. It can only use links it found itself or that you paste here.
        </span>
        <textarea id="staff_notes" name="staff_notes" rows={3} maxLength={4000} defaultValue={state.notes}
          aria-describedby="staff_notes-hint" />
      </div>
      <div className="field">
        <label htmlFor="passcode">Team passcode</label>
        <span id="passcode-hint" className="hint">Stops people outside the team using up the AI credit.</span>
        <input id="passcode" name="passcode" type="password" autoComplete="off" required aria-describedby="passcode-hint" />
      </div>
      {state.message && (
        <p ref={msgRef} tabIndex={-1} className={state.status === 'success' ? 'success' : 'error'}
          role={state.status === 'success' ? 'status' : 'alert'}>{state.message}</p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? 'Preparing AI draft… this can take up to a minute' : 'Prepare AI draft'}
      </button>
    </form>
  );
}
