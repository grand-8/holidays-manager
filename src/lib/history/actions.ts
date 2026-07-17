"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { logAudit } from "@/lib/audit";

/**
 * Import et correction de l'historique (spec section 5.1).
 * Chaque année importée est un Cycle (origine=importé, statut=clôturé) ne portant
 * que des FamilyRight. Toute modification est journalisée dans l'AuditLog.
 */

export type HistoryState = { status: "idle" | "saved" | "error"; message?: string };

const yearSchema = z.coerce.number().int().min(1990).max(2100);

/** Ajoute une année d'historique (cycle importé, clôturé, vide). */
export async function addImportYear(
  _prev: HistoryState,
  formData: FormData,
): Promise<HistoryState> {
  const admin = await requireAdmin();
  const parsed = yearSchema.safeParse(formData.get("annee"));
  if (!parsed.success) {
    return { status: "error", message: "Année invalide." };
  }
  const annee = parsed.data;

  const existing = await prisma.cycle.findUnique({
    where: { propertyId_annee: { propertyId: admin.propertyId, annee } },
  });
  if (existing) {
    return { status: "error", message: `L'année ${annee} existe déjà.` };
  }

  await prisma.cycle.create({
    data: {
      propertyId: admin.propertyId,
      annee,
      statut: "cloture",
      origine: "importe",
    },
  });

  revalidatePath("/admin/import");
  return { status: "saved", message: `Année ${annee} ajoutée.` };
}

/**
 * Enregistre la grille années × familles. Pour chaque cellule (cycle, famille) :
 * vide → pas de droit ; 1/2 → droit correspondant. Chaque changement effectif
 * est journalisé (ancienne/nouvelle valeur, qui, quand).
 */
export async function saveHistory(
  _prev: HistoryState,
  formData: FormData,
): Promise<HistoryState> {
  const admin = await requireAdmin();

  // Cycles clôturés du bien + droits actuels.
  const cycles = await prisma.cycle.findMany({
    where: { propertyId: admin.propertyId, statut: "cloture" },
    include: { familyRights: true },
  });
  const families = await prisma.user.findMany({
    where: { propertyId: admin.propertyId, actif: true },
    select: { id: true },
  });
  const familyIds = new Set(families.map((f) => f.id));

  await prisma.$transaction(async (tx) => {
    for (const cycle of cycles) {
      const rightByUser = new Map(
        cycle.familyRights.map((r) => [r.userId, r]),
      );
      for (const userId of familyIds) {
        const raw = formData.get(`cell_${cycle.id}_${userId}`);
        const desired = raw === "1" ? 1 : raw === "2" ? 2 : null;
        const current = rightByUser.get(userId);
        const currentVal = current?.nombreSemaines ?? null;
        if (desired === currentVal) continue;

        if (desired === null && current) {
          await tx.familyRight.delete({ where: { id: current.id } });
          await logAudit(tx, {
            tableConcernee: "FamilyRight",
            enregistrementId: current.id,
            champ: "nombreSemaines",
            ancienneValeur: String(currentVal),
            nouvelleValeur: null,
            modifiePar: admin.email,
          });
        } else if (desired !== null && current) {
          await tx.familyRight.update({
            where: { id: current.id },
            data: { nombreSemaines: desired },
          });
          await logAudit(tx, {
            tableConcernee: "FamilyRight",
            enregistrementId: current.id,
            champ: "nombreSemaines",
            ancienneValeur: String(currentVal),
            nouvelleValeur: String(desired),
            modifiePar: admin.email,
          });
        } else if (desired !== null && !current) {
          const created = await tx.familyRight.create({
            data: { cycleId: cycle.id, userId, nombreSemaines: desired },
          });
          await logAudit(tx, {
            tableConcernee: "FamilyRight",
            enregistrementId: created.id,
            champ: "nombreSemaines",
            ancienneValeur: null,
            nouvelleValeur: String(desired),
            modifiePar: admin.email,
          });
        }
      }
    }
  });

  revalidatePath("/admin/import");
  revalidatePath("/historique");
  return { status: "saved", message: "Historique enregistré." };
}
