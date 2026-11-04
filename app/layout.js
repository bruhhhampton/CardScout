import './globals.css';
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-AU">
      {/* suppressHydrationWarning: browser extensions sometimes add attributes to <body> */}
      <body suppressHydrationWarning>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
