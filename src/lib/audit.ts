import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Journal d'audit (spec sections 5 & 7). Table strictement en ajout seul :
 * on n'y insère que des lignes, jamais de modification ni suppression.
 */
type Db = PrismaClient | Prisma.TransactionClient;

export async function logAudit(
  db: Db,
  entry: {
    tableConcernee: string;
    enregistrementId: string;
    champ: string;
    ancienneValeur: string | null;
    nouvelleValeur: string | null;
    modifiePar: string;
  },
): Promise<void> {
  await db.auditLog.create({ data: entry });
}
