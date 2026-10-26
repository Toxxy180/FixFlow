import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  logging: { serverFunctions: false },
  async headers() {
    return [
      {
        source: '/auth/recovery',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};
export default config;
