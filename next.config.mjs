/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/privacy',
        destination: '/?view=privacy',
      },
      {
        source: '/terms',
        destination: '/?view=terms',
      },
    ];
  },
};

export default nextConfig;
