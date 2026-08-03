import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the server bundle so it loads as a normal Node module at runtime
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
