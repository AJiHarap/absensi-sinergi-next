/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow Webpack to interop ESM/CJS smoothly (fixes supabase-js wrapper import)
    esmExternals: 'loose',
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
