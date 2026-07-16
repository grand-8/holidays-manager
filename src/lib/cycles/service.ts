import { prisma } from "@/lib/prisma";

/**
 * Helpers de lecture et de validation autour du cycle (spec sections 3 & 4.1).
 * Pas de "use server" ici : ce sont des utilitaires appelés par les Server
 * Actions (qui, elles, portent l'authz) et les Server Components.
 */

/** Le cycle actif d'un bien (tout statut différent de « clôturé »), ou null. */
export async function getActiveCycle(propertyId: string) {
  return prisma.cycle.findFirst({
    where: { propertyId, statut: { not: "cloture" } },
    orderBy: { annee: "desc" },
  });
}

/** Détail complet d'un cycle pour l'écran de configuration. */
export async function getCycleConfig(cycleId: string) {
  return prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      weekSlots: { orderBy: { ordre: "asc" } },
      familyRights: { include: { user: true } },
      property: {
        include: {
          users: {
            where: { actif: true },
            orderBy: { nomAffiche: "asc" },
          },
        },
      },
    },
  });
}

export type CompletionRow = {
  userId: string;
  nomAffiche: string;
  optedOut: boolean;
  responded: boolean;
};

/**
 * Suivi de complétion (spec section 4.3) : pour chaque famille active, a-t-elle
 * répondu (préférences soumises ou opt-out) ou est-elle en attente. Le DÉTAIL
 * des préférences n'est jamais exposé ici.
 */
export async function getCompletion(
  cycleId: string,
  propertyId: string,
): Promise<CompletionRow[]> {
  const [users, rights, optOuts] = await Promise.all([
    prisma.user.findMany({
      where: { propertyId, actif: true },
      orderBy: { nomAffiche: "asc" },
      select: { id: true, nomAffiche: true },
    }),
    prisma.familyRight.findMany({
      where: { cycleId },
      select: { userId: true, soumisLe: true },
    }),
    prisma.optOut.findMany({ where: { cycleId }, select: { userId: true } }),
  ]);

  const soumisMap = new Map(rights.map((r) => [r.userId, r.soumisLe]));
  const optSet = new Set(optOuts.map((o) => o.userId));

  return users.map((u) => {
    const optedOut = optSet.has(u.id);
    return {
      userId: u.id,
      nomAffiche: u.nomAffiche,
      optedOut,
      responded: optedOut || (soumisMap.get(u.id) ?? null) !== null,
    };
  });
}

export type Coherence = {
  totalRights: number;
  weekCount: number;
  ok: boolean;
};

/**
 * Validation de cohérence (spec section 4.1) : la somme des semaines de droit
 * ne doit pas dépasser le nombre de semaines disponibles.
 */
export function checkCoherence(
  rights: { nombreSemaines: number }[],
  weekCount: number,
): Coherence {
  const totalRights = rights.reduce((s, r) => s + r.nombreSemaines, 0);
  return { totalRights, weekCount, ok: totalRights <= weekCount };
}
