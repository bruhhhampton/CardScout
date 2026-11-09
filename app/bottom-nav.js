'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The app's tab bar. Scan is the main job, so it sits in the middle and stands out.
const ICON = {
  offers: <path d="M4 6h16M4 12h16M4 18h10" />,
  find: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><rect x="8" y="7" width="8" height="10" rx="1" /></>,
  review: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-3.5 3.8-5 7-5s6 1.5 7 5" /></>,
  settings: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
};
const TABS = [
  { href: '/', key: 'offers', label: 'Offers', match: (p) => p === '/' || p.startsWith('/offers') },
  { href: '/find', key: 'find', label: 'Find', match: (p) => p.startsWith('/find') || p.startsWith('/players') },
  { href: '/scan', key: 'scan', label: 'Scan', match: (p) => p.startsWith('/scan') },
  { href: '/review', key: 'review', label: 'Owner', match: (p) => p.startsWith('/review') },
  { href: '/settings', key: 'settings', label: 'More', match: (p) => p.startsWith('/settings') },
];

export default function BottomNav() {
  const path = usePathname() ?? '/';
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const on = t.match(path);
        return (
          <Link key={t.key} href={t.href} className={`tab tab-${t.key}${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[t.key]}</svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
