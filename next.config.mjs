/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // In development, the Codespace forwards the app through *.app.github.dev.
      // Trust that address only in development. The published site keeps the strict check.
      allowedOrigins:
        process.env.NODE_ENV === 'development' ? ['*.app.github.dev', 'localhost:3000'] : [],
    },
  },
};
export default nextConfig;