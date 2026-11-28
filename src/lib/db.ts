/**
 * Compatibility façade for legacy imports.
 *
 * The shared Prisma singleton now lives in src/shared/database/client.ts.
 * Keep this path until all existing consumers have been migrated.
 */
export { db } from "@/shared/database/client";
