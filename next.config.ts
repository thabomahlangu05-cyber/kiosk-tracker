import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the server bundle so it loads as a normal Node module at runtime
  serverExternalPackages: ["@prisma/client"],
  // The slideshow lists public/slideshow at request time, so those files have
  // to be traced into the serverless bundle or the folder is empty in prod.
  outputFileTracingIncludes: {
    "/*": ["public/slideshow/**/*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
