import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter. Postgres everywhere (Railway /
// Supabase in prod, a local Postgres in dev) so dev and prod stay identical.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  // Serverless: each function instance gets its own pool, so keep it to a
  // single connection and drop it quickly. Point DATABASE_URL at Supabase's
  // transaction-mode pooler (port 6543) so these don't exhaust the database.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

// Cached in every environment: avoids extra pools if the module is evaluated
// more than once (dev HMR, or separate serverless bundles sharing a global).
globalForPrisma.prisma = prisma;
