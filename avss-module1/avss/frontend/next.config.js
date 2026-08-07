/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // Proxies frontend API calls to the FastAPI backend during dev
        source: "/api/backend/:path*",
        destination: "http://localhost:8001/api/v1/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
