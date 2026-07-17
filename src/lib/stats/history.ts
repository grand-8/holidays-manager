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

/**
 * Statistiques complètes visibles par toutes les familles (spec section 5) :
 * sur 5 ans glissants, par famille, le nombre de fois avec 2 semaines, l'année
 * de la dernière occurrence, et le score de satisfaction moyen obtenu.
 * Le score de satisfaction vient du planning retenu (FinalSchedule → proposition
 * → scoreIndividuel) ; les cycles importés (sans planning) en sont exclus.
 */
export type FamilyStats = {
  userId: string;
  nomAffiche: string;
  actif: boolean;
  timesWith2Weeks: number;
  lastYearWith2Weeks: number | null;
  avgSatisfaction: number | null;
};

export async function getFamilyStats(
  propertyId: string,
): Promise<FamilyStats[]> {
  const currentYear = new Date().getUTCFullYear();
  const [users, cycles] = await Promise.all([
    prisma.user.findMany({
      where: { propertyId },
      orderBy: { nomAffiche: "asc" },
      select: { id: true, nomAffiche: true, actif: true },
    }),
    prisma.cycle.findMany({
      where: {
        propertyId,
        statut: "cloture",
        annee: { gte: currentYear - HISTORY_YEARS },
      },
      include: {
        familyRights: { select: { userId: true, nombreSemaines: true } },
        finalSchedule: {
          include: {
            proposal: {
              include: {
                assignments: {
                  select: { userId: true, scoreIndividuel: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Accumulateurs par famille.
  const acc = new Map<
    string,
    { count2: number; lastYear2: number | null; scores: number[] }
  >();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) {
      a = { count2: 0, lastYear2: null, scores: [] };
      acc.set(id, a);
    }
    return a;
  };

  for (const cycle of cycles) {
    for (const r of cycle.familyRights) {
      if (r.nombreSemaines === 2) {
        const a = get(r.userId);
        a.count2 += 1;
        a.lastYear2 = Math.max(a.lastYear2 ?? 0, cycle.annee);
      }
    }
    // Score de satisfaction : une seule valeur par famille et par cycle.
    const proposal = cycle.finalSchedule?.proposal;
    if (proposal) {
      const seen = new Set<string>();
      for (const asg of proposal.assignments) {
        if (seen.has(asg.userId)) continue;
        seen.add(asg.userId);
        get(asg.userId).scores.push(asg.scoreIndividuel);
      }
    }
  }

  return users.map((u) => {
    const a = acc.get(u.id);
    const avg =
      a && a.scores.length > 0
        ? a.scores.reduce((s, x) => s + x, 0) / a.scores.length
        : null;
    return {
      userId: u.id,
      nomAffiche: u.nomAffiche,
      actif: u.actif,
      timesWith2Weeks: a?.count2 ?? 0,
      lastYearWith2Weeks: a?.lastYear2 ?? null,
      avgSatisfaction: avg,
    };
  });
}
