import { prisma } from "@/lib/prisma";

/**
 * Grille d'édition de l'historique (spec section 5.1) : années (cycles clôturés)
 * × familles actives, valeur = nombre de semaines (1 ou 2) ou vide.
 */
export type HistoryGrid = {
  families: { userId: string; nomAffiche: string }[];
  years: {
    cycleId: string;
    annee: number;
    origine: string;
    rights: Record<string, number>;
  }[];
};

export async function getHistoryGrid(
  propertyId: string,
): Promise<HistoryGrid> {
  const [families, cycles] = await Promise.all([
    prisma.user.findMany({
      where: { propertyId, actif: true },
      orderBy: { nomAffiche: "asc" },
      select: { id: true, nomAffiche: true },
    }),
    prisma.cycle.findMany({
      where: { propertyId, statut: "cloture" },
      orderBy: { annee: "desc" },
      include: { familyRights: { select: { userId: true, nombreSemaines: true } } },
    }),
  ]);

  return {
    families: families.map((f) => ({ userId: f.id, nomAffiche: f.nomAffiche })),
    years: cycles.map((c) => ({
      cycleId: c.id,
      annee: c.annee,
      origine: c.origine,
      rights: Object.fromEntries(
        c.familyRights.map((r) => [r.userId, r.nombreSemaines]),
      ),
    })),
  };
}
