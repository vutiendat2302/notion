import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  async rewrites() {
    const backendBaseUrl = process.env.INTERNAL_API_BASE_URL?.replace(/\/$/, "");
    if (!backendBaseUrl) return [];
    return [{
      source: "/api/v1/:path*",
      destination: `${backendBaseUrl}/:path*`,
    }];
  },
};

export default nextConfig;
