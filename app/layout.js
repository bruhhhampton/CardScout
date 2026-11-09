import './globals.css';
import Link from 'next/link';
import BottomNav from './bottom-nav';

export const metadata = {
  title: 'CardScout',
  description: 'Card offer assessments for shop staff',
  appleWebApp: { capable: true, title: 'CardScout', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101113',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
      </head>
      {/* suppressHydrationWarning: browser extensions sometimes add attributes to <body> */}
      <body suppressHydrationWarning>
        {/* Wordmark: wide capitals, with the O drawn as a card. */}
        <Link href="/" className="brand" aria-label="CardScout home">
          <span aria-hidden="true">CARDSC</span>
          <svg className="brand-o" viewBox="0 0 14 20" width="13" height="19" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="17" rx="2.6" fill="none" stroke="currentColor" strokeWidth="2.6" /></svg>
          <span aria-hidden="true">UT</span>
        </Link>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
