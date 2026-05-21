/**
 * Prisma Client Singleton
 * 
 * Creates a single PrismaClient instance shared across the application.
 * In development, stores the instance on globalThis to prevent multiple
 * connections during hot reloading (Next.js re-imports modules on each reload).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;