import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Needed for large video uploads via the local dev mock provider (up to 500 MB)
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
