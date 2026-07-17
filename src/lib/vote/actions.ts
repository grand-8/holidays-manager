"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth/current-user";
import { getActiveCycle } from "@/lib/cycles/service";
import { pickWinner } from "./service";
import { getUnclaimedWeekIds } from "@/lib/unclaimed/service";
import { sendFinalScheduleEmail } from "@/lib/emails/final";
import { sendUnclaimedWeeksEmail } from "@/lib/emails/unclaimed";

/**
 * Vote et décision finale (spec section 4.6).
 * Contrôles côté serveur : on ne vote que pour une proposition du cycle en
 * statut « vote » et tant qu'aucune décision finale n'a été prise.
 */

export type CastVoteState = { status: "idle" | "saved" | "error"; message?: string };

/** Une famille vote (ou modifie son vote) pour une proposition. */
export async function castVote(
  _prev: CastVoteState,
  formData: FormData,
): Promise<CastVoteState> {
  const user = await requireUser();
  const cycle = await getActiveCycle(user.propertyId);
  if (!cycle || cycle.statut !== "vote") {
    return { status: "error", message: "Le vote n'est pas ouvert." };
  }
  // Une décision déjà prise verrouille le vote.
  const decided = await prisma.finalSchedule.findUnique({
    where: { cycleId: cycle.id },
  });
  if (decided) {
    return { status: "error", message: "La décision est déjà prise." };
  }

  const proposalId = String(formData.get("proposalId") ?? "");
  const proposal = await prisma.scheduleProposal.findFirst({
    where: { id: proposalId, cycleId: cycle.id },
    select: { id: true },
  });
  if (!proposal) {
    return { status: "error", message: "Proposition inconnue." };
  }

  await prisma.vote.upsert({
    where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
    create: {
      cycleId: cycle.id,
      userId: user.id,
      scheduleProposalId: proposal.id,
    },
    update: { scheduleProposalId: proposal.id },
  });

  revalidatePath("/vote");
  return { status: "saved", message: "Vote enregistré." };
}

// --- Décision (admin) --------------------------------------------------------

/**
 * Notifie toutes les familles actives : planning final confirmé, et — s'il reste
 * des semaines non attribuées — leur mise à disposition (spec section 6, items
 * 7 et 9). Les échecs d'envoi ne bloquent pas la décision.
 */
async function notifyFinal(propertyId: string, cycleId: string, annee: number) {
  const [property, users, unclaimedIds] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: { nom: true },
    }),
    prisma.user.findMany({
      where: { propertyId, actif: true },
      select: { email: true },
    }),
    getUnclaimedWeekIds(cycleId),
  ]);
  const lieu = property?.nom ?? "Vacances familiales";
  await Promise.allSettled(
    users.flatMap((u) => {
      const mails = [sendFinalScheduleEmail(u.email, annee, lieu)];
      if (unclaimedIds.length > 0) {
        mails.push(sendUnclaimedWeeksEmail(u.email, annee, lieu));
      }
      return mails;
    }),
  );
}

/** Décision automatique fondée sur les votes (plus de votes, puis score global). */
export async function decideByVote(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      proposals: { include: { _count: { select: { votes: true } } } },
      finalSchedule: true,
    },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) return;
  if (cycle.statut !== "vote" || cycle.finalSchedule) return;

  const winnerId = pickWinner(
    cycle.proposals.map((p) => ({
      id: p.id,
      globalScore: p.scoreGlobal,
      voteCount: p._count.votes,
    })),
  );
  if (!winnerId) return;

  await prisma.finalSchedule.create({
    data: {
      cycleId: cycle.id,
      scheduleProposalId: winnerId,
      decidePar: "auto",
    },
  });
  await notifyFinal(cycle.propertyId, cycle.id, cycle.annee);

  revalidatePath("/vote");
  revalidatePath("/admin");
  redirect("/admin");
}

export type ForceDecisionState = { status: "idle" | "error"; message?: string };

const forceSchema = z.object({
  cycleId: z.string().min(1),
  proposalId: z.string().min(1),
  commentaire: z.string().trim().min(1, "Un commentaire justificatif est obligatoire."),
});

/** Décision forcée par l'admin, avec commentaire justificatif obligatoire. */
export async function forceDecision(
  _prev: ForceDecisionState,
  formData: FormData,
): Promise<ForceDecisionState> {
  const admin = await requireAdmin();
  const parsed = forceSchema.safeParse({
    cycleId: formData.get("cycleId"),
    proposalId: formData.get("proposalId"),
    commentaire: formData.get("commentaire"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const cycle = await prisma.cycle.findUnique({
    where: { id: parsed.data.cycleId },
    include: { finalSchedule: true },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) {
    return { status: "error", message: "Cycle introuvable." };
  }
  if (cycle.statut !== "vote" || cycle.finalSchedule) {
    return { status: "error", message: "La décision est déjà prise." };
  }
  const proposal = await prisma.scheduleProposal.findFirst({
    where: { id: parsed.data.proposalId, cycleId: cycle.id },
    select: { id: true },
  });
  if (!proposal) {
    return { status: "error", message: "Proposition inconnue." };
  }

  await prisma.finalSchedule.create({
    data: {
      cycleId: cycle.id,
      scheduleProposalId: proposal.id,
      decidePar: "admin",
      commentaireAdmin: parsed.data.commentaire,
    },
  });
  await notifyFinal(cycle.propertyId, cycle.id, cycle.annee);

  revalidatePath("/vote");
  revalidatePath("/admin");
  redirect("/admin");
}
