/** @type {import('next').NextConfig} */
const nextConfig = {
  // Card photos are shrunk on the phone to about 300 KB each before upload; this leaves room for two.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
 