import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 does not auto-load .env for the config file; do it explicitly.
try {
  process.loadEnvFile();
} catch {
  // .env is optional (e.g. when DATABASE_URL is already in the environment)
}

// Prisma 7 configuration. The datasource URL here is used by Migrate / CLI
// commands; the runtime PrismaClient gets its connection via a driver adapter
// (src/lib/db.ts). DATABASE_URL is read from .env.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
