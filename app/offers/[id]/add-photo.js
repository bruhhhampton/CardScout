'use client';

import { useActionState, useRef, useState } from 'react';
import { addPhoto } from './actions';
import { shrinkPhoto } from '@/lib/shrink-photo';

// Add or replace the card's photo from the card page (for cards that were typed in, or a better shot).
export default function AddPhoto({ offerId, has }) {
  const [state, action, pending] = useActionState(addPhoto, { status: 'idle', message: '' });
  const [busy, setBusy] = useState(false);
  const form = useRef(null);
  const data = useRef(null);
  return (
    <form ref={form} action={action} className="add-photo">
      <input type="hidden" name="offer_id" value={offerId} />
      <input type="hidden" name="photo" ref={data} />
      <label className="add-photo-btn">
        <input type="file" accept="image/*" className="sr-only" disabled={busy || pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try { data.current.value = await shrinkPhoto(file); form.current.requestSubmit(); } catch { data.current.value = ''; } finally { setBusy(false); e.target.value = ''; }
          }} />
        {busy || pending ? 'Saving…' : has ? 'Replace photo' : 'Add photo'}
      </label>
      {state.status === 'error' && <span className="field-error" role="alert">{state.message}</span>}
    </form>
  );
}
