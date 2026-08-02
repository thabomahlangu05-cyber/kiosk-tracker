import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  // Force DATABASE_URL to be used and skip schema introspection on every request
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
    process.env.PRISMA_SKIP_VALIDATION_WARNINGS = "true";
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    errorFormat: "pretty",
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
