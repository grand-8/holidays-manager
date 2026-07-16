import { PrismaClient } from "@prisma/client";

/**
 * Singleton du client Prisma.
 * En développement, Next.js recharge les modules à chaud ; sans singleton on
 * ouvrirait une nouvelle connexion à chaque rechargement.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
