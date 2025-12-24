/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@packages/ui"],
    output: 'standalone',
};

module.exports = nextConfig;
