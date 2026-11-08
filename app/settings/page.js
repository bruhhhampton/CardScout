import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { toFormValues } from '@/lib/settings-fields';
import SettingsForm from './settings-form';
import { getAudRates } from '@/lib/fx.mjs';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [{ settings, error }, fx] = await Promise.all([getSettings(), getAudRates()]);
  return (
    <main>
      <header className="appbar">
        <h1>Owner settings</h1>
        <p className="sub">Your buying rules. Every assessment uses these, so staff apply your judgement the same way each time.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {settings && (
        <>
          {settings.provisional && (
            <p className="notice">
              Provisional values. The player weights and thresholds come from the owner&apos;s buying model. The spending,
              stock and pricing limits are placeholders until the owner confirms them. Choose No under &quot;Are these values
              still provisional?&quot; once the owner has confirmed them.
            </p>
          )}
          <p className="hint">There is no login yet. Anyone with this link can change these settings, so share it only with the team and tutor.</p>
          <p className="hint">
            {Object.keys(fx.rates).length
              ? `Today's exchange rates for overseas sales: ${Object.entries(fx.rates).map(([c, r]) => `A$${r} per 1 ${c}`).join(' · ')}${fx.date ? ` (${fx.date})` : ''}. Source: ${fx.source}. Your own rate below replaces today's rate.`
              : "Today's exchange rates could not be loaded. Overseas sales are only counted in currencies where you enter your own rate below."}
          </p>
          <SettingsForm initial={toFormValues(settings)} />
        </>
      )}
      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
