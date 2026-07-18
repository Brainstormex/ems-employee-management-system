import type { NextConfig } from "next";

/**
 * Proxy /api/* to the Express backend so auth cookies are set on the
 * frontend origin. Middleware can then read accessToken/refreshToken.
 *
 * Server-only: API_PROXY_TARGET (defaults to http://localhost:4000)
 * Optional client override: NEXT_PUBLIC_API_URL (leave empty to use same-origin /api)
 */
const proxyTarget =
  process.env.API_PROXY_TARGET || "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${proxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
