import { prisma } from "@/lib/prisma";

/**
 * Semaines non réclamées (spec section 4.9).
 * Après la décision finale, toute semaine de la période non attribuée par le
 * planning retenu (offre > demande, ou semaine libérée par un opt-out) devient
 * disponible. Les familles manifestent leur intérêt (WeekInterest) ; l'admin
 * assigne manuellement (FreeWeekAssignment), sans arbitrage automatique.
 *
 * Ce mécanisme est entièrement séparé de l'algorithme (section 4.5) : il ne
 * touche jamais aux scores et ne s'applique qu'aux semaines hors planning.
 */

export type UnclaimedFamily = { userId: string; nomAffiche: string };

export type UnclaimedWeek = {
  weekSlotId: string;
  ordre: number;
  dateDebut: string;
  dateFin: string;
  /** Famille à qui l'admin a attribué la semaine, ou null si encore libre. */
  assignedTo: UnclaimedFamily | null;
  /** Familles ayant manifesté leur intérêt (transparent, comme le reste). */
  interested: UnclaimedFamily[];
  /** La famille courante s'est-elle déclarée intéressée ? */
  iAmInterested: boolean;
};

export type UnclaimedData = {
  cycleId: string;
  annee: number;
  statut: string;
  /** Cycle clôturé : la fonction est fermée (plus d'intérêt ni d'attribution). */
  closed: boolean;
  /** Toutes les familles actives — pour l'attribution forcée par l'admin (§4.9). */
  allFamilies: UnclaimedFamily[];
  weeks: UnclaimedWeek[];
};

/**
 * Le cycle « décidé » le plus récent d'un bien (celui qui porte un planning
 * final), qu'il soit encore en vote ou déjà clôturé. C'est le cycle dont on
 * ouvre les semaines non réclamées.
 */
export async function getDecidedCycle(propertyId: string) {
  return prisma.cycle.findFirst({
    where: { propertyId, finalSchedule: { isNot: null } },
    orderBy: { annee: "desc" },
    select: { id: true, annee: true, statut: true },
  });
}

/**
 * Identifiants des semaines non attribuées par le planning retenu d'un cycle.
 * = toutes les WeekSlot du cycle − celles attribuées dans la proposition
 * retenue. (Une médiation sans proposition retenue laisse tout disponible ;
 * elle enregistrera ses propres attributions, section 4.7.)
 */
export async function getUnclaimedWeekIds(cycleId: string): Promise<string[]> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: {
      weekSlots: { select: { id: true } },
      finalSchedule: {
        select: {
          proposal: { select: { assignments: { select: { weekSlotId: true } } } },
        },
      },
    },
  });
  if (!cycle) return [];
  const assigned = new Set(
    cycle.finalSchedule?.proposal?.assignments.map((a) => a.weekSlotId) ?? [],
  );
  return cycle.weekSlots.filter((w) => !assigned.has(w.id)).map((w) => w.id);
}

/** Données de la page des semaines non réclamées pour la famille `userId`. */
export async function getUnclaimedData(
  propertyId: string,
  userId: string,
): Promise<UnclaimedData | null> {
  const decided = await getDecidedCycle(propertyId);
  if (!decided) return null;

  const [cycle, familyRows] = await Promise.all([
    prisma.cycle.findUnique({
      where: { id: decided.id },
      include: {
        weekSlots: { orderBy: { ordre: "asc" } },
        finalSchedule: {
          include: {
            proposal: { include: { assignments: { select: { weekSlotId: true } } } },
          },
        },
        freeWeekAssignments: {
          include: { user: { select: { id: true, nomAffiche: true } } },
        },
        weekInterests: {
          include: { user: { select: { id: true, nomAffiche: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { propertyId, actif: true },
      orderBy: { nomAffiche: "asc" },
      select: { id: true, nomAffiche: true },
    }),
  ]);
  if (!cycle) return null;

  const assigned = new Set(
    cycle.finalSchedule?.proposal?.assignments.map((a) => a.weekSlotId) ?? [],
  );
  const assignmentByWeek = new Map(
    cycle.freeWeekAssignments.map((f) => [f.weekSlotId, f.user]),
  );
  const interestByWeek = new Map<string, UnclaimedFamily[]>();
  for (const wi of cycle.weekInterests) {
    const list = interestByWeek.get(wi.weekSlotId) ?? [];
    list.push({ userId: wi.user.id, nomAffiche: wi.user.nomAffiche });
    interestByWeek.set(wi.weekSlotId, list);
  }

  const weeks: UnclaimedWeek[] = cycle.weekSlots
    .filter((w) => !assigned.has(w.id))
    .map((w) => {
      const interested = (interestByWeek.get(w.id) ?? []).sort((a, b) =>
        a.nomAffiche.localeCompare(b.nomAffiche),
      );
      const assignedTo = assignmentByWeek.get(w.id) ?? null;
      return {
        weekSlotId: w.id,
        ordre: w.ordre,
        dateDebut: w.dateDebut.toISOString(),
        dateFin: w.dateFin.toISOString(),
        assignedTo: assignedTo
          ? { userId: assignedTo.id, nomAffiche: assignedTo.nomAffiche }
          : null,
        interested,
        iAmInterested: interested.some((f) => f.userId === userId),
      };
    });

  return {
    cycleId: cycle.id,
    annee: cycle.annee,
    statut: cycle.statut,
    closed: cycle.statut === "cloture",
    allFamilies: familyRows.map((f) => ({
      userId: f.id,
      nomAffiche: f.nomAffiche,
    })),
    weeks,
  };
}
