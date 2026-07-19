"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { scoreFamily } from "@/lib/scheduling/generate";
import type { FamilyInput, PreferenceStatus } from "@/lib/scheduling/types";
import { transitionToMediation, getMediationData } from "./service";
import { getUnclaimedWeekIds } from "@/lib/unclaimed/service";
import { sendFinalScheduleEmail } from "@/lib/emails/final";
import { sendUnclaimedWeeksEmail } from "@/lib/emails/unclaimed";

/**
 * Actions admin du mode de secours (spec section 4.7) : médiation manuelle,
 * passage manuel en médiation, redémarrage complet du cycle.
 */

// --- Passage manuel en médiation --------------------------------------------

/** L'admin bascule manuellement le cycle bloqué en médiation (§4.7.2). */
export async function goToMediation(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { propertyId: true, statut: true, annee: true },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) return;
  if (cycle.statut !== "collecte" && cycle.statut !== "collecte_tour2") return;

  await transitionToMediation(cycleId, cycle.annee, cycle.propertyId);
  revalidatePath("/admin");
  revalidatePath("/tableau-de-bord");
  redirect("/admin");
}

// --- Médiation manuelle ------------------------------------------------------

export type MediationState = { status: "idle" | "error"; message?: string };

const commentSchema = z
  .string()
  .trim()
  .min(1, "Un commentaire justificatif est obligatoire.");

/**
 * Enregistre l'attribution manuelle de médiation (spec section 4.7.2). Valide
 * l'attribution avec les mêmes contraintes dures que l'algorithme (droit exact,
 * pas de semaine « impossible », pas de double attribution), note chaque famille
 * avec les règles habituelles, puis crée le planning retenu (décidé par l'admin).
 */
export async function saveMediation(
  _prev: MediationState,
  formData: FormData,
): Promise<MediationState> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { propertyId: true, statut: true, annee: true, finalSchedule: true },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) {
    return { status: "error", message: "Cycle introuvable." };
  }
  if (cycle.statut !== "mediation" || cycle.finalSchedule) {
    return { status: "error", message: "La médiation n'est pas ouverte." };
  }

  const parsedComment = commentSchema.safeParse(formData.get("commentaire"));
  if (!parsedComment.success) {
    return {
      status: "error",
      message: parsedComment.error.issues[0]?.message ?? "Commentaire requis.",
    };
  }

  const data = await getMediationData(cycleId, admin.propertyId);
  if (!data) return { status: "error", message: "Données indisponibles." };

  const ordreByWeekSlot = new Map(data.weeks.map((w) => [w.id, w.ordre]));
  const usedWeeks = new Set<string>();
  const assignmentsToCreate: {
    userId: string;
    weekSlotId: string;
    scoreIndividuel: number;
    fractionnementForce: boolean;
  }[] = [];
  const familyScores: number[] = [];

  for (const fam of data.families) {
    const selected = formData.getAll(`week_${fam.userId}`).map(String);
    if (selected.length !== fam.nombreSemaines) {
      return {
        status: "error",
        message: `${fam.nomAffiche} : sélectionnez exactement ${fam.nombreSemaines} semaine(s).`,
      };
    }
    for (const weekSlotId of selected) {
      if (!ordreByWeekSlot.has(weekSlotId)) {
        return { status: "error", message: "Semaine inconnue." };
      }
      if (usedWeeks.has(weekSlotId)) {
        return {
          status: "error",
          message: "Une même semaine ne peut être attribuée à deux familles.",
        };
      }
      if (fam.prefs[weekSlotId] === "impossible") {
        return {
          status: "error",
          message: `${fam.nomAffiche} a marqué une semaine attribuée comme « impossible ».`,
        };
      }
      usedWeeks.add(weekSlotId);
    }

    // Note la famille avec les règles de l'algorithme (fractionnement forcé → 30 %).
    const familyInput: FamilyInput = {
      id: fam.userId,
      rightWeeks: fam.nombreSemaines === 2 ? 2 : 1,
      acceptsSplit: fam.acceptsSplit,
      prefs: Object.fromEntries(
        Object.entries(fam.prefs).map(([weekSlotId, statut]) => [
          ordreByWeekSlot.get(weekSlotId)!,
          statut as PreferenceStatus,
        ]),
      ),
    };
    const ordres = selected.map((id) => ordreByWeekSlot.get(id)!);
    const { score, forcedSplit } = scoreFamily(familyInput, ordres);
    familyScores.push(score);
    for (const weekSlotId of selected) {
      assignmentsToCreate.push({
        userId: fam.userId,
        weekSlotId,
        scoreIndividuel: score,
        fractionnementForce: forcedSplit,
      });
    }
  }

  const scoreGlobal =
    familyScores.reduce((s, v) => s + v, 0) / (familyScores.length || 1);
  const scoreMinimum = familyScores.length ? Math.min(...familyScores) : 0;

  // Planning de médiation = proposition synthétique + planning retenu (admin).
  await prisma.$transaction(async (tx) => {
    const proposal = await tx.scheduleProposal.create({
      data: {
        cycleId,
        scoreGlobal,
        scoreMinimum,
        assignments: { create: assignmentsToCreate },
      },
    });
    await tx.finalSchedule.create({
      data: {
        cycleId,
        scheduleProposalId: proposal.id,
        decidePar: "admin",
        commentaireAdmin: parsedComment.data,
      },
    });
  });

  // Notifie : planning final + éventuelles semaines non réclamées (§6.7 & §6.9).
  const [property, users, unclaimedIds] = await Promise.all([
    prisma.property.findUnique({
      where: { id: cycle.propertyId },
      select: { nom: true },
    }),
    prisma.user.findMany({
      where: { propertyId: cycle.propertyId, actif: true },
      select: { email: true },
    }),
    getUnclaimedWeekIds(cycleId),
  ]);
  const lieu = property?.nom ?? "Vacances familiales";
  const annee = cycle.annee;
  after(() =>
    Promise.allSettled(
      users.flatMap((u) => {
        const mails = [sendFinalScheduleEmail(u.email, annee, lieu)];
        if (unclaimedIds.length > 0) {
          mails.push(sendUnclaimedWeeksEmail(u.email, annee, lieu));
        }
        return mails;
      }),
    ),
  );

  revalidatePath("/admin");
  revalidatePath("/vote");
  revalidatePath("/tableau-de-bord");
  redirect("/admin");
}

// --- Redémarrage complet -----------------------------------------------------

/**
 * Redémarrage complet du cycle (spec section 4.7.3) : remet à zéro préférences,
 * opt-outs, propositions, votes, décision et second tour, et repasse en `config`.
 * L'admin pourra ajuster la période/les droits puis relancer la collecte
 * (ce qui renvoie l'invitation à toutes les familles).
 */
export async function forceRestart(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { propertyId: true, statut: true },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) return;
  if (cycle.statut === "cloture") return;

  await prisma.$transaction([
    prisma.finalSchedule.deleteMany({ where: { cycleId } }),
    // Supprime les propositions (cascade : attributions + votes).
    prisma.scheduleProposal.deleteMany({ where: { cycleId } }),
    prisma.preference.deleteMany({ where: { cycleId } }),
    prisma.optOut.deleteMany({ where: { cycleId } }),
    prisma.weekInterest.deleteMany({ where: { cycleId } }),
    prisma.freeWeekAssignment.deleteMany({ where: { cycleId } }),
    prisma.secondRoundParticipant.deleteMany({ where: { cycleId } }),
    prisma.familyRight.updateMany({
      where: { cycleId },
      data: { soumisLe: null, accepteFractionnement: false },
    }),
    prisma.cycle.update({
      where: { id: cycleId },
      // Redémarrage à zéro → réarme toutes les relances (nouvelles deadlines).
      data: {
        statut: "config",
        relancePref7Le: null,
        relancePref3Le: null,
        relanceVote7Le: null,
        relanceVote3Le: null,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/tableau-de-bord");
  revalidatePath("/vote");
  redirect("/admin");
}
