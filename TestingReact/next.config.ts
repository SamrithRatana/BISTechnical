import type { NextConfig } from "next";
import { EventEmitter } from "events";

// Increase default max listeners for Node.js process to support concurrent API proxy routes & SSE streams
EventEmitter.defaultMaxListeners = 100;

function r2PublicHostname(): string | null {
  const raw = process.env.R2_PUBLIC_BASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const R2_HOST = r2PublicHostname();

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "react-hot-toast",
    ],
  },

  /**
   * Keeping this key is what pins the project to webpack.
   *
   * Next 16 runs Turbopack by default, and a `webpack` key with no `turbopack`
   * key beside it is a hard build error ("This build is using Turbopack, with a
   * `webpack` config..."), not a warning. That is why BOTH `dev` and `build` in
   * package.json pass `--webpack` explicitly — dropping the flag from either
   * one breaks that command outright. If you want to move to Turbopack, the two
   * ignore-warnings rules below have to be migrated to a `turbopack` config
   * first; removing the flags alone does not do it.
   */
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /face-api/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },

  images: {
    remotePatterns: R2_HOST
      ? [{ protocol: "https" as const, hostname: R2_HOST }]
      : [],
  },

  env: {
    NEXT_PUBLIC_R2_PUBLIC_HOST: R2_HOST ?? "",
  },

  devIndicators: false,

  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.*.*.*",
    "192.168.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ],
};

export default nextConfig;
