import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/.well-known/oauth-protected-resource",
      destination: "/api/oauth/well-known",
    },
  ],
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Service-Worker-Allowed",
          value: "/",
        },
        {
          key: "Cache-Control",
          value: "no-cache",
        },
      ],
    },
  ],
};

export default nextConfig;
