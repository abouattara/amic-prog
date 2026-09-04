import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Needed for large video uploads via the local dev mock provider (up to 500 MB)
    serverBodySizeLimit: '500mb',
  },
};

export default nextConfig;
