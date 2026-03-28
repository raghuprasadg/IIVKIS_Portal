/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: transpile local workspace packages
  transpilePackages: ['@iivkis/shared', '@iivkis/ui'],
};

module.exports = nextConfig;
