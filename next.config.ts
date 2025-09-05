import type { NextConfig } from "next";

const r2Host = process.env.R2_PUBLIC_HOSTNAME;

const nextConfig: NextConfig = {
  output: 'standalone',

  images: {
    // Umożliwia ładowanie obrazów z Cloudflare R2 presigned URLs
    remotePatterns: r2Host ? [
      {
        protocol: 'https',
        hostname: r2Host,
      },
    ] : [],
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async headers() {
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;