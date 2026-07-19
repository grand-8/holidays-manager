import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildGenerateInput } from "@/lib/cycles/generation";
import { bestCombination } from "@/lib/scheduling/generate";
import { sendSecondRoundEmail, sendMediationEmail } from "@/lib/emails/fallback";

/**
 * Mode de secours (spec section 4.7) — helpers serveur (pas d'exposition POST).
 * Cascade : second tour ciblé → médiation → (redémarrage, action admin dédiée).
 */

export type FallbackAnalysis = {
  /** Familles à recibler au second tour (score sous le seuil, ou toutes à défaut). */
  concernedUserIds: string[];
  /** Ordres des semaines demandées par au moins deux familles (tension). */
  tensionOrdres: number[];
};

/**
 * Analyse un cycle en échec de génération : qui reste sous le seuil, et quelles
 * semaines sont « en tension » (demandées par plusieurs familles). Sert au ciblage
 * du second tour et à l'affichage anonymisé (spec section 4.7.1).
 */
export async function analyzeFallback(cycleId: string): Promise<FallbackAnalysis> {
  const { input } = await buildGenerateInput(cycleId);
  const seuil = input.seuilScoreMinimum;
  const best = bestCombination(input);

  let concerned = best
    ? best.assignments.filter((a) => a.score < seuil).map((a) => a.familyId)
    : [];
  // Aucune combinaison, ou personne sous le seuil mais fallback quand même
  // (ex. manque de diversité) : on rouvre à toutes les familles participantes.
  if (concerned.length === 0) concerned = input.families.map((f) => f.id);

  const demand = new Map<number, number>();
  for (const f of input.families) {
    for (const [ordreStr, statut] of Object.entries(f.prefs)) {
      if (statut === "preferee" || statut === "alternative") {
        const o = Number(ordreStr);
        demand.set(o, (demand.get(o) ?? 0) + 1);
      }
    }
  }
  const tensionOrdres = [...demand.entries()]
    .filter(([, c]) => c >= 2)
    .map(([o]) => o)
    .sort((a, b) => a - b);

  return { concernedUserIds: concerned, tensionOrdres };
}

/**
 * Bascule le cycle en second tour ciblé (spec section 4.7.1) : enregistre les
 * familles concernées, réinitialise leur marqueur de soumission (elles doivent
 * réajuster), passe en `collecte_tour2` et les notifie. Les préférences des
 * autres familles restent verrouillées et inchangées.
 */
export async function transitionToSecondRound(
  cycleId: string,
  annee: number,
  concernedUserIds: string[],
): Promise<void> {
  await prisma.$transaction([
    ...concernedUserIds.map((userId) =>
      prisma.secondRoundParticipant.upsert({
        where: { cycleId_userId: { cycleId, userId } },
        create: { cycleId, userId },
        update: {},
      }),
    ),
    prisma.familyRight.updateMany({
      where: { cycleId, userId: { in: concernedUserIds } },
      data: { soumisLe: null },
    }),
    prisma.cycle.update({
      where: { id: cycleId },
      // Nouvelle deadline possible au second tour → réarme les relances préf.
      data: { statut: "collecte_tour2", relancePref7Le: null, relancePref3Le: null },
    }),
  ]);

  const [cycle, users] = await Promise.all([
    prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { property: { select: { nom: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: concernedUserIds }, actif: true },
      select: { email: true },
    }),
  ]);
  const lieu = cycle?.property.nom ?? "Vacances familiales";
  // Notifications après la réponse : l'admin n'attend pas Resend.
  after(() =>
    Promise.allSettled(
      users.map((u) => sendSecondRoundEmail(u.email, annee, lieu)),
    ),
  );
}

/**
 * Bascule le cycle en médiation admin (spec section 4.7.2). Notifie toutes les
 * familles actives du passage en médiation.
 */
export async function transitionToMediation(
  cycleId: string,
  annee: number,
  propertyId: string,
): Promise<void> {
  await prisma.cycle.update({
    where: { id: cycleId },
    data: { statut: "mediation" },
  });
  const [property, users] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { nom: true },
    }),
    prisma.user.findMany({
      where: { propertyId, actif: true },
      select: { email: true },
    }),
  ]);
  const lieu = property?.nom ?? "Vacances familiales";
  after(() =>
    Promise.allSettled(
      users.map((u) => sendMediationEmail(u.email, annee, lieu)),
    ),
  );
}

/** La famille `userId` peut-elle saisir au second tour de ce cycle ? */
export async function isSecondRoundParticipant(
  cycleId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.secondRoundParticipant.findUnique({
    where: { cycleId_userId: { cycleId, userId } },
    select: { id: true },
  });
  return row !== null;
}

export type MediationFamily = {
  userId: string;
  nomAffiche: string;
  nombreSemaines: number;
  acceptsSplit: boolean;
  /** Statut par weekSlotId (préférée / alternative / impossible ; non_coché absent). */
  prefs: Record<string, string>;
};

export type MediationData = {
  cycleId: string;
  annee: number;
  weeks: { id: string; ordre: number; dateDebut: string; dateFin: string }[];
  families: MediationFamily[];
};

/**
 * Données de médiation (spec section 4.7.2) : toutes les préférences en clair,
 * réservées à l'admin. Les familles en opt-out ne sont pas à placer.
 * `propertyId` doit être celui de l'appelant : garde de cloisonnement portée
 * par la fonction elle-même (voir `getVoteData`, même rationale).
 */
export async function getMediationData(
  cycleId: string,
  propertyId: string,
): Promise<MediationData | null> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      weekSlots: { orderBy: { ordre: "asc" } },
      familyRights: { include: { user: true } },
      optOuts: true,
      preferences: true,
    },
  });
  if (!cycle || cycle.propertyId !== propertyId) return null;

  const optedOut = new Set(cycle.optOuts.map((o) => o.userId));
  const prefsByUser = new Map<string, Record<string, string>>();
  for (const p of cycle.preferences) {
    const m = prefsByUser.get(p.userId) ?? {};
    m[p.weekSlotId] = p.statut;
    prefsByUser.set(p.userId, m);
  }

  const families: MediationFamily[] = cycle.familyRights
    .filter((r) => !optedOut.has(r.userId))
    .map((r) => ({
      userId: r.userId,
      nomAffiche: r.user.nomAffiche,
      nombreSemaines: r.nombreSemaines,
      acceptsSplit: r.accepteFractionnement,
      prefs: prefsByUser.get(r.userId) ?? {},
    }))
    .sort((a, b) => a.nomAffiche.localeCompare(b.nomAffiche));

  return {
    cycleId: cycle.id,
    annee: cycle.annee,
    weeks: cycle.weekSlots.map((w) => ({
      id: w.id,
      ordre: w.ordre,
      dateDebut: w.dateDebut.toISOString(),
      dateFin: w.dateFin.toISOString(),
    })),
    families,
  };
}
