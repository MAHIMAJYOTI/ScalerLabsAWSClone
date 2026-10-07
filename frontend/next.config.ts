import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Rewrites are baked in at BUILD time (Vercel), so a production build without
// BACKEND_URL would silently proxy to localhost — fail loudly instead.
export default function nextConfig(phase: string): NextConfig {
  const rawBackendUrl = process.env.BACKEND_URL;
  if (phase === PHASE_PRODUCTION_BUILD && !rawBackendUrl) {
    throw new Error(
      "BACKEND_URL must be set for production builds: the /api/* rewrite is " +
        "evaluated at build time. Example: BACKEND_URL=https://your-backend.up.railway.app",
    );
  }
  const backendUrl = (rawBackendUrl ?? "http://localhost:8000").replace(
    /\/+$/,
    "",
  );

  return {
    async rewrites() {
      // The browser only ever talks to same-origin /api so the backend session
      // cookie stays first-party; Next proxies to the FastAPI backend.
      return [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    },
  };
}
