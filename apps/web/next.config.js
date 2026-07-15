/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@packages/ui', '@packages/shared', '@packages/database', 'react-pdf'],
  output: 'standalone',
  // Proxy /api/readings/* requests to the NestJS API backend
  async rewrites() {
    return [
      {
        source: '/api/readings/:path*',
        destination: `${process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.oraclelumira.com'}/api/readings/:path*`,
      },
    ];
  },
  webpack: (config) => {
    // react-pdf / pdfjs — avoid bundling node canvas
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
