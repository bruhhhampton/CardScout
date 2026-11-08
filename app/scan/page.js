import { cookies } from 'next/headers';
import { isRemembered } from '@/lib/agent-access';
import ScanFlow from './scan-flow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scan · CardScout' };

export default async function ScanPage({ searchParams }) {
  const remembered = isRemembered(await cookies());
  const sp = await searchParams;
  // A card picked from a player's profile in Find players arrives filled in.
  const keys = ['player', 'year', 'set_name', 'card_number', 'variant'];
  const prefill = typeof sp?.player === 'string' ? Object.fromEntries(keys.map((k) => [k, String(sp[k] ?? '').slice(0, 120)])) : null;
  return (
    <main>
      <header className="appbar"><h1>Scan</h1></header>
      <ScanFlow remembered={remembered} prefill={prefill} />
    </main>
  );
}
