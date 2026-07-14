/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@packages/ui", "@packages/shared", "@packages/database"],
    output: 'standalone',
    // Proxy /api/readings/* requests to the NestJS API backend
    async rewrites() {
        return [
            {
                source: '/api/readings/:path*',
                destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://api.oraclelumira.com'}/api/readings/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
