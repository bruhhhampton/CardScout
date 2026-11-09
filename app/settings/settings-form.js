'use client';

import { useActionState, useEffect, useRef } from 'react';
import { SETTINGS_SECTIONS, SETTINGS_FIELDS } from '@/lib/settings-fields';
import { saveSettingsAction } from './actions';

// Each group of settings folds open. All groups stay in one form, so Save still saves everything at once.
export default function SettingsForm({ initial, notes = {} }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, {
    status: 'idle', message: '', errors: {}, values: initial, attempt: 0,
  });
  const formRef = useRef(null);
  const msgRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error') {
      const first = SETTINGS_FIELDS.find((f) => state.errors[f.name]);
      if (first) formRef.current?.elements[first.name]?.focus();
      else msgRef.current?.focus();
    } else if (state.status === 'success') msgRef.current?.focus();
  }, [state]);

  return (
    <>
      {state.message && (
        <p ref={msgRef} tabIndex={-1} className={state.status === 'success' ? 'success' : 'error'}
          role={state.status === 'success' ? 'status' : 'alert'}>{state.message}</p>
      )}
      <form ref={formRef} action={formAction} key={state.attempt} noValidate className="settings-form">
        {SETTINGS_SECTIONS.map((sec) => (
          <details key={sec.title} className="group" open={sec.fields.some((f) => state.errors[f.name])}>
            <summary><span>{sec.title}</span><span className="group-count">{sec.fields.length}</span></summary>
          <fieldset>
            <legend className="sr-only">{sec.title}</legend>
            {sec.intro && <p className="hint">{sec.intro}</p>}
            {notes[sec.title] && <p className="hint">{notes[sec.title]}</p>}
            <div className="offer-form">
              {sec.fields.map((f) => {
                const err = state.errors[f.name];
                return (
                  <div key={f.name} className={`field${err ? ' has-error' : ''}`}>
                    <label htmlFor={f.name}>{f.label}</label>
                    {f.hint && <span id={`${f.name}-hint`} className="hint">{f.hint}</span>}
                    {f.kind === 'rule' ? (
                      <select id={f.name} name={f.name} defaultValue={state.values[f.name] ?? 'ask'}
                        aria-invalid={err ? 'true' : undefined}
                        aria-describedby={[f.hint && `${f.name}-hint`, err && `${f.name}-error`].filter(Boolean).join(' ') || undefined}>
                        <option value="allow">Allow</option>
                        <option value="ask">Ask me</option>
                        <option value="decline">Don&apos;t buy</option>
                      </select>
                    ) : f.kind === 'yesno' ? (
                      <select id={f.name} name={f.name} defaultValue={state.values[f.name] ?? 'no'}
                        aria-invalid={err ? 'true' : undefined}
                        aria-describedby={[f.hint && `${f.name}-hint`, err && `${f.name}-error`].filter(Boolean).join(' ') || undefined}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <input id={f.name} name={f.name} type="text" defaultValue={state.values[f.name] ?? ''}
                        inputMode={f.kind === 'text' ? undefined : 'decimal'} autoComplete="off"
                        aria-invalid={err ? 'true' : undefined}
                        aria-describedby={[f.hint && `${f.name}-hint`, err && `${f.name}-error`].filter(Boolean).join(' ') || undefined} />
                    )}
                    {err && <span id={`${f.name}-error`} className="field-error">{err}</span>}
                  </div>
                );
              })}
            </div>
          </fieldset>
          </details>
        ))}
        <div className="offer-form save-row"><button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </>
  );
}
