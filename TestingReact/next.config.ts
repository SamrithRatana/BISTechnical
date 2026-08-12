import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.222",
    "192.168.0.222:3000",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.*",
  ],
};

export default nextConfig;
