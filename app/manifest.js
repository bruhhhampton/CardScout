// Lets staff add CardScout to their phone's home screen; it then opens full screen like an app.
export default function manifest() {
  return {
    name: 'CardScout',
    short_name: 'CardScout',
    description: 'Card offer assessments for shop staff',
    start_url: '/scan',
    display: 'standalone',
    background_color: '#141413',
    theme_color: '#141413',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
