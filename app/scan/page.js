import { cookies } from 'next/headers';
import { isRemembered } from '@/lib/agent-access';
import ScanFlow from './scan-flow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scan · CardScout' };

export default async function ScanPage() {
  const remembered = isRemembered(await cookies());
  return (
    <main>
      <header className="appbar"><h1>Scan</h1></header>
      <ScanFlow remembered={remembered} />
    </main>
  );
}
