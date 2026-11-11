'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export default function SignInForm({ next }) {
  const [state, action, pending] = useActionState(signIn, { error: null });
  return (
    <form action={action} className="signin-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="passcode">Team passcode</label>
      <input id="passcode" name="passcode" type="password" autoComplete="current-password" required autoFocus aria-invalid={state.error ? 'true' : undefined} aria-describedby={state.error ? 'signin-error' : undefined} />
      {state.error && <p id="signin-error" className="field-error" role="alert">{state.error}</p>}
      <label className="keep"><input type="checkbox" name="keep" defaultChecked /> Keep me signed in on this phone</label>
      <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
