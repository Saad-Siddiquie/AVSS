/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Backend proxy ───────────────────────────────────────────────────────────
  async rewrites() {
    return [
      {
        source:      "/api/backend/:path*",
        destination: "http://localhost:8002/api/v1/:path*",
      },
    ];
  },

  // ── Allow images/videos from Supabase Storage ────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── Allow <video> from Supabase (Content Security Policy) ────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Allow MJPEG stream + local backend
              "img-src 'self' data: blob: http://localhost:8002 https://*.supabase.co",
              // Allow Supabase videos + local backend
              "media-src 'self' http://localhost:8002 https://*.supabase.co blob:",
              "connect-src 'self' http://localhost:8002 https://*.supabase.co wss://*.supabase.co",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
