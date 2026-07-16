import { prisma } from "@/lib/prisma";

/**
 * Aide à la décision pour l'attribution des droits (spec sections 4.1 & 5).
 * Sur les 5 dernières années glissantes de cycles CLÔTURÉS (générés ou importés) :
 * pour chaque famille, le nombre de fois où elle a eu 2 semaines et l'année de
 * la dernière occurrence. Purement indicatif — l'admin reste libre.
 */
export type FamilyConfigHistory = {
  timesWith2Weeks: number;
  lastYearWith2Weeks: number | null;
};

const HISTORY_YEARS = 5;

export async function getConfigHistory(
  propertyId: string,
): Promise<Map<string, FamilyConfigHistory>> {
  const currentYear = new Date().getUTCFullYear();
  const rights = await prisma.familyRight.findMany({
    where: {
      cycle: {
        propertyId,
        statut: "cloture",
        annee: { gte: currentYear - HISTORY_YEARS },
      },
    },
    select: { userId: true, nombreSemaines: true, cycle: { select: { annee: true } } },
  });

  const map = new Map<string, FamilyConfigHistory>();
  for (const r of rights) {
    if (r.nombreSemaines !== 2) continue;
    const cur = map.get(r.userId) ?? { timesWith2Weeks: 0, lastYearWith2Weeks: null };
    cur.timesWith2Weeks += 1;
    cur.lastYearWith2Weeks = Math.max(cur.lastYearWith2Weeks ?? 0, r.cycle.annee);
    map.set(r.userId, cur);
  }
  return map;
}
