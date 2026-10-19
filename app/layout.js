import './globals.css';

export const metadata = {
  title: 'CardScout',
  description: 'Card offer assessments for shop staff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
