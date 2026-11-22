import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  async rewrites() {
    const configured = process.env.INTERNAL_API_BASE_URL?.replace(/\/$/, "");
    const publicAbs =
      process.env.NEXT_PUBLIC_API_BASE_URL?.startsWith("http")
        ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
        : null;
    const devFallback =
      process.env.NODE_ENV !== "production" ? "http://127.0.0.1:8010/api/v1" : null;
    const backendBaseUrl = configured || publicAbs || devFallback;
    if (!backendBaseUrl) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
