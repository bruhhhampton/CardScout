import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { toFormValues } from '@/lib/settings-fields';
import SettingsForm from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { settings, error } = await getSettings();
  return (
    <main>
      <p><Link href="/">← All offers</Link></p>
      <header>
        <h1>Owner settings</h1>
        <p className="sub">Your buying rules. Every assessment uses these, so staff apply your judgement the same way each time.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {settings && (
        <>
          {settings.provisional && (
            <p className="notice">
              Provisional values. The player weights and thresholds come from Cerf&apos;s CERF model. The spending,
              stock and pricing limits are placeholders until the owner confirms them. Saving marks them as confirmed.
            </p>
          )}
          <p className="hint">There is no login yet. Anyone with this link can change these settings, so share it only with the team and tutor.</p>
          <SettingsForm initial={toFormValues(settings)} />
        </>
      )}
      <footer>CardScout never buys cards automatically.</footer>
    </main>
  );
}
