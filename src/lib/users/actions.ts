"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/current-user";

/**
 * Gestion des familles / utilisateurs (spec section 8).
 * - Aucune inscription publique : seul un admin crée des comptes.
 * - Désactivation plutôt que suppression (préserve l'historique, section 2).
 * - Il doit toujours rester au moins un admin actif : on empêche de retirer le
 *   rôle admin ou de désactiver le dernier admin restant.
 */

export type UserActionState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  nomAffiche: z.string().trim().min(1, "Le nom est requis."),
});

/** Crée une nouvelle famille dans le bien de l'admin. */
export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    nomAffiche: formData.get("nomAffiche"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return { status: "error", message: "Cette adresse email existe déjà." };
  }

  await prisma.user.create({
    data: {
      email: parsed.data.email,
      nomAffiche: parsed.data.nomAffiche,
      propertyId: admin.propertyId,
    },
  });

  revalidatePath("/admin/utilisateurs");
  return { status: "saved", message: `Famille « ${parsed.data.nomAffiche} » ajoutée.` };
}

/** Nombre d'admins actifs du bien. */
async function countActiveAdmins(propertyId: string): Promise<number> {
  return prisma.user.count({
    where: { propertyId, isAdmin: true, actif: true },
  });
}

/**
 * Bascule le rôle admin ou l'état actif d'une famille, avec garde du dernier admin.
 * `champ` vaut "admin" ou "actif".
 */
export async function toggleUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const champ = String(formData.get("champ") ?? "");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.propertyId !== admin.propertyId) {
    return { status: "error", message: "Utilisateur introuvable." };
  }

  const activeAdmins = await countActiveAdmins(admin.propertyId);
  const isLastActiveAdmin =
    target.isAdmin && target.actif && activeAdmins <= 1;

  if (champ === "admin") {
    // Retrait du rôle admin au dernier admin actif → interdit.
    if (target.isAdmin && isLastActiveAdmin) {
      return {
        status: "error",
        message: "Impossible de retirer le rôle du dernier admin.",
      };
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { isAdmin: !target.isAdmin },
    });
    revalidatePath("/admin/utilisateurs");
    return { status: "saved" };
  }

  if (champ === "actif") {
    // Désactivation du dernier admin actif → interdit.
    if (target.actif && isLastActiveAdmin) {
      return {
        status: "error",
        message: "Impossible de désactiver le dernier admin.",
      };
    }
    await prisma.user.update({
      where: { id: target.id },
      data: { actif: !target.actif },
    });
    revalidatePath("/admin/utilisateurs");
    return { status: "saved" };
  }

  return { status: "error", message: "Action inconnue." };
}
