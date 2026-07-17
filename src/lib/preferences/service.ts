import { prisma } from "@/lib/prisma";
import { analyzeFallback } from "@/lib/fallback/service";

/**
 * Contexte de saisie des préférences pour une famille (spec section 4.2).
 * Retourne le cycle en collecte, le droit de la famille, ses préférences
 * existantes et son éventuel opt-out. `null` si aucun cycle n'est en collecte.
 *
 * Au second tour (spec section 4.7.1) : indique si la famille est ciblée
 * (`secondRoundLocked` = ciblée:false / verrouillée:true) et les semaines « en
 * tension » à montrer de façon anonymisée (`tensionOrdres`).
 */
export async function getPreferencesContext(userId: string, propertyId: string) {
  const cycle = await prisma.cycle.findFirst({
    where: { propertyId, statut: { in: ["collecte", "collecte_tour2"] } },
    orderBy: { annee: "desc" },
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

  const isSecondRound = cycle.statut === "collecte_tour2";
  let secondRoundLocked = false;
  let tensionOrdres: number[] = [];
  if (isSecondRound) {
    const participant = await prisma.secondRoundParticipant.findUnique({
      where: { cycleId_userId: { cycleId: cycle.id, userId } },
      select: { id: true },
    });
    secondRoundLocked = participant === null;
    if (!secondRoundLocked) {
      tensionOrdres = (await analyzeFallback(cycle.id)).tensionOrdres;
    }
  }

  return {
    cycle,
    right,
    prefs,
    optOut,
    isSecondRound,
    secondRoundLocked,
    tensionOrdres,
  };
}
