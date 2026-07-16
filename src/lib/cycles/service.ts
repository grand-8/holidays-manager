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
