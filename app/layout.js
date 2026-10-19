import './globals.css';

export const metadata = {
  title: 'CardScout',
  description: 'Card offer assessments for shop staff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-AU">
      {/* suppressHydrationWarning: browser extensions sometimes add attributes to <body> */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
