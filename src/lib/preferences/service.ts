import { prisma } from "@/lib/prisma";

/**
 * Contexte de saisie des préférences pour une famille (spec section 4.2).
 * Retourne le cycle en collecte, le droit de la famille, ses préférences
 * existantes et son éventuel opt-out. `null` si aucun cycle n'est en collecte.
 */
export async function getPreferencesContext(userId: string, propertyId: string) {
  const cycle = await prisma.cycle.findFirst({
    where: { propertyId, statut: { in: ["collecte", "collecte_tour2"] } },
    include: { weekSlots: { orderBy: { ordre: "asc" } } },
  });
  if (!cycle) return null;

  const [right, prefs, optOut] = await Promise.all([
    prisma.familyRight.findUnique({
      where: { cycleId_userId: { cycleId: cycle.id, userId } },
    }),
    prisma.preference.findMany({ where: { cycleId: cycle.id, userId } }),
    prisma.optOut.findUnique({
      where: { cycleId_userId: { cycleId: cycle.id, userId } },
    }),
  ]);

  return { cycle, right, prefs, optOut };
}
