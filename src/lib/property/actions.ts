"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";

/**
 * Mise à jour du nom du lieu loué (spec section 7, Property.nom). Ce nom apparaît
 * dans le sujet et le corps de toutes les notifications email (section 6). Action
 * réservée à l'admin ; le changement est journalisé (§5).
 */

export type PropertyNameState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

const nomSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit comporter au moins 2 caractères.")
  .max(80, "Le nom ne peut pas dépasser 80 caractères.");

export async function updatePropertyName(
  _prev: PropertyNameState,
  formData: FormData,
): Promise<PropertyNameState> {
  const admin = await requireAdmin();

  const parsed = nomSchema.safeParse(formData.get("nom"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }
  const nom = parsed.data;

  const property = await prisma.property.findUnique({
    where: { id: admin.propertyId },
    select: { nom: true },
  });
  if (!property) return { status: "error", message: "Bien introuvable." };
  if (property.nom === nom) {
    return { status: "saved", message: "Nom déjà à jour." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: admin.propertyId },
      data: { nom },
    });
    await logAudit(tx, {
      tableConcernee: "Property",
      enregistrementId: admin.propertyId,
      champ: "nom",
      ancienneValeur: property.nom,
      nouvelleValeur: nom,
      modifiePar: admin.id,
    });
  });

  revalidatePath("/admin");
  revalidatePath("/tableau-de-bord");
  return { status: "saved", message: "Nom du lieu enregistré." };
}
