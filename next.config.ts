import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma + the native SQLite driver out of the server bundle so they
  // load as normal Node modules at runtime.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;
