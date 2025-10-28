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
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const headers = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              isDevelopment 
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com http://localhost:* http://192.168.*:* ws://localhost:* ws://192.168.*:*"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https: http:",
              "media-src 'self' data: blob: https:",
              isDevelopment
                ? "connect-src 'self' https://apis.google.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://firebase.googleapis.com wss://ws-us3.pusher.com http://localhost:* http://192.168.*:* ws://localhost:* ws://192.168.*:*" + (r2Host ? ` https://${r2Host}` : '')
                : "connect-src 'self' https://apis.google.com https://securetoken.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://firebase.googleapis.com wss://ws-us3.pusher.com" + (r2Host ? ` https://${r2Host}` : ''),
              "frame-src 'self' https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'"
            ].join('; ') + (isDevelopment ? '' : '; upgrade-insecure-requests')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()'
          }
        ],
      },
    ];

    // Add HSTS only in production
    if (process.env.NODE_ENV === 'production') {
      headers[0].headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      });
    }

    return headers;
  },
};

export default nextConfig;