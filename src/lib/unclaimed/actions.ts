"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth/current-user";
import { getDecidedCycle, getUnclaimedWeekIds } from "./service";

/**
 * Actions des semaines non réclamées (spec section 4.9).
 * Contrôles côté serveur : on ne manipule que le cycle décidé du bien de
 * l'utilisateur, et uniquement des semaines réellement non attribuées.
 */

export type InterestState = { status: "idle" | "saved" | "error"; message?: string };

const weekSchema = z.object({ weekSlotId: z.string().min(1) });

/** La famille (dé)clare son intérêt pour une semaine disponible (toggle). */
export async function toggleInterest(
  _prev: InterestState,
  formData: FormData,
): Promise<InterestState> {
  const user = await requireUser();
  const parsed = weekSchema.safeParse({ weekSlotId: formData.get("weekSlotId") });
  if (!parsed.success) {
    return { status: "error", message: "Semaine invalide." };
  }

  const decided = await getDecidedCycle(user.propertyId);
  if (!decided) {
    return { status: "error", message: "Aucun planning décidé." };
  }
  // La semaine doit appartenir au cycle décidé et être réellement disponible.
  const unclaimed = new Set(await getUnclaimedWeekIds(decided.id));
  if (!unclaimed.has(parsed.data.weekSlotId)) {
    return { status: "error", message: "Cette semaine n'est pas disponible." };
  }
  // Une semaine déjà attribuée n'accepte plus de manifestation d'intérêt.
  const attributed = await prisma.freeWeekAssignment.findFirst({
    where: { cycleId: decided.id, weekSlotId: parsed.data.weekSlotId },
    select: { id: true },
  });
  if (attributed) {
    return { status: "error", message: "Cette semaine est déjà attribuée." };
  }

  const existing = await prisma.weekInterest.findUnique({
    where: {
      cycleId_weekSlotId_userId: {
        cycleId: decided.id,
        weekSlotId: parsed.data.weekSlotId,
        userId: user.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.weekInterest.delete({ where: { id: existing.id } });
  } else {
    await prisma.weekInterest.create({
      data: {
        cycleId: decided.id,
        weekSlotId: parsed.data.weekSlotId,
        userId: user.id,
      },
    });
  }

  revalidatePath("/semaines-libres");
  return { status: "saved" };
}

// --- Attribution manuelle (admin) --------------------------------------------

/** L'admin attribue une semaine disponible à une famille intéressée. */
export async function assignFreeWeek(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");
  const weekSlotId = String(formData.get("weekSlotId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!cycleId || !weekSlotId || !userId) return;

  const decided = await getDecidedCycle(admin.propertyId);
  if (!decided || decided.id !== cycleId) return;

  const unclaimed = new Set(await getUnclaimedWeekIds(cycleId));
  if (!unclaimed.has(weekSlotId)) return;

  // On n'attribue qu'à une famille ayant manifesté son intérêt (spec 4.9).
  const interest = await prisma.weekInterest.findUnique({
    where: { cycleId_weekSlotId_userId: { cycleId, weekSlotId, userId } },
    select: { id: true },
  });
  if (!interest) return;

  await prisma.freeWeekAssignment.upsert({
    where: { cycleId_weekSlotId: { cycleId, weekSlotId } },
    create: { cycleId, weekSlotId, userId },
    update: { userId },
  });

  revalidatePath("/semaines-libres");
}

/** L'admin retire l'attribution d'une semaine (elle redevient disponible). */
export async function unassignFreeWeek(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");
  const weekSlotId = String(formData.get("weekSlotId") ?? "");
  if (!cycleId || !weekSlotId) return;

  const decided = await getDecidedCycle(admin.propertyId);
  if (!decided || decided.id !== cycleId) return;

  await prisma.freeWeekAssignment.deleteMany({
    where: { cycleId, weekSlotId },
  });

  revalidatePath("/semaines-libres");
}
