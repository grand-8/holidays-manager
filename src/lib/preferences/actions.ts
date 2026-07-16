"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Saisie des préférences par une famille (spec section 4.2).
 * Sécurité : une famille ne peut modifier que SES propres préférences, et
 * uniquement tant que le cycle est en collecte (contrôle côté serveur).
 */

const STATUTS = ["preferee", "alternative", "impossible", "non_coche"] as const;
const statutSchema = z.enum(STATUTS);

/** Récupère le cycle en collecte du bien de l'utilisateur, avec son droit. */
async function getEditableCycle(userId: string, propertyId: string) {
  const cycle = await prisma.cycle.findFirst({
    where: { propertyId, statut: { in: ["collecte", "collecte_tour2"] } },
    include: { weekSlots: { select: { id: true } } },
  });
  if (!cycle) return null;
  const right = await prisma.familyRight.findUnique({
    where: { cycleId_userId: { cycleId: cycle.id, userId } },
  });
  if (!right) return null;
  return { cycle, right };
}

export type SavePrefsState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

export async function savePreferences(
  _prev: SavePrefsState,
  formData: FormData,
): Promise<SavePrefsState> {
  const user = await requireUser();
  const ctx = await getEditableCycle(user.id, user.propertyId);
  if (!ctx) {
    return { status: "error", message: "Aucune collecte en cours." };
  }
  const { cycle, right } = ctx;

  // Familles à 2 semaines : la réponse au fractionnement est obligatoire (section 4.2).
  let accepteFractionnement = right.accepteFractionnement;
  if (right.nombreSemaines === 2) {
    const answer = formData.get("accepteFractionnement");
    if (answer !== "oui" && answer !== "non") {
      return {
        status: "error",
        message:
          "Indiquez si vous acceptez que vos 2 semaines soient scindées si nécessaire.",
      };
    }
    accepteFractionnement = answer === "oui";
  }

  // Lit un statut par semaine (défaut non_coché), en n'acceptant que les
  // weekSlots du cycle (les ids inconnus sont ignorés).
  const validIds = new Set(cycle.weekSlots.map((w) => w.id));
  const toCreate: { weekSlotId: string; statut: (typeof STATUTS)[number] }[] = [];
  for (const id of validIds) {
    const raw = formData.get(`statut_${id}`);
    const parsed = statutSchema.safeParse(raw ?? "non_coche");
    const statut = parsed.success ? parsed.data : "non_coche";
    // On ne stocke que les statuts non-défaut : « non_coché » = absence de ligne.
    if (statut !== "non_coche") toCreate.push({ weekSlotId: id, statut });
  }

  await prisma.$transaction([
    // Participer annule un éventuel opt-out.
    prisma.optOut.deleteMany({ where: { cycleId: cycle.id, userId: user.id } }),
    prisma.preference.deleteMany({ where: { cycleId: cycle.id, userId: user.id } }),
    prisma.preference.createMany({
      data: toCreate.map((p) => ({
        cycleId: cycle.id,
        userId: user.id,
        weekSlotId: p.weekSlotId,
        statut: p.statut,
      })),
    }),
    prisma.familyRight.update({
      where: { id: right.id },
      data: { accepteFractionnement, soumisLe: new Date() },
    }),
  ]);

  revalidatePath("/preferences");
  revalidatePath("/tableau-de-bord");
  return { status: "saved", message: "Préférences enregistrées." };
}

/** Opt-out : « Je ne prends pas de vacances cette année » (section 4.2). */
export async function optOut(): Promise<void> {
  const user = await requireUser();
  const ctx = await getEditableCycle(user.id, user.propertyId);
  if (!ctx) return;
  await prisma.optOut.upsert({
    where: { cycleId_userId: { cycleId: ctx.cycle.id, userId: user.id } },
    create: { cycleId: ctx.cycle.id, userId: user.id },
    update: {},
  });
  revalidatePath("/preferences");
  revalidatePath("/tableau-de-bord");
}

/** Annule l'opt-out : la famille participe à nouveau. */
export async function cancelOptOut(): Promise<void> {
  const user = await requireUser();
  const ctx = await getEditableCycle(user.id, user.propertyId);
  if (!ctx) return;
  await prisma.optOut.deleteMany({
    where: { cycleId: ctx.cycle.id, userId: user.id },
  });
  revalidatePath("/preferences");
  revalidatePath("/tableau-de-bord");
}
