'use client';

import { useActionState, useEffect, useRef } from 'react';
import { forgetPasscode, prepareDraft } from './actions';

export default function AgentPanel({ offerId, remembered = false, autoStart = false }) {
  const [state, formAction, pending] = useActionState(prepareDraft, { status: 'idle', message: '', notes: '', attempt: 0 });
  const formRef = useRef(null);
  const msgRef = useRef(null);
  const started = useRef(false);
  useEffect(() => { if (state.message) msgRef.current?.focus(); }, [state]);

  // Start the draft once, straight after the player was linked, if the passcode is remembered.
  // The draft=1 flag is removed from the address first, so a refresh never starts a second paid run.
  useEffect(() => {
    if (!autoStart || !remembered || started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('draft');
    window.history.replaceState(null, '', url.pathname + url.search);
    formRef.current?.requestSubmit();
  }, [autoStart, remembered]);

  return (
    <>
      <form ref={formRef} action={formAction} key={state.attempt} className="agent-form">
        <input type="hidden" name="offer_id" value={offerId} />
        <div className="field">
          <label htmlFor="staff_notes">Notes for the AI (optional)</label>
          <span id="staff_notes-hint" className="hint">
            Paste any sold listing links you found, or anything the AI should know. It can only use links it found itself or that you paste here.
          </span>
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
          {pending ? 'Preparing AI draft… this can take up to a minute' : 'Prepare AI draft'}
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
