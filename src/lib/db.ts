import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Shared Prisma client — plain, no extensions.
 *
 * Promethe wraps its client with a soft-delete extension, but Gaïa's
 * Note.deletedAt is handled explicitly in src/server/gaia.ts (every read
 * filters deletedAt, trash/restore/permanent are explicit mutations), so no
 * extension is needed here.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
