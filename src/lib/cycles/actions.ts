"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/current-user";
import { computeWeekSlots } from "@/lib/scheduling/weeks";
import { checkCoherence, getActiveCycle } from "./service";
import { sendInvitationEmail } from "@/lib/emails/invitation";

/** Parse une date "YYYY-MM-DD" en Date UTC (minuit), ou null. */
function parseUtcDate(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// --- Création d'un cycle -----------------------------------------------------

export type CreateCycleState = { status: "idle" | "error"; message?: string };

const createSchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100),
  seuil: z.coerce.number().int().min(0).max(100),
});

export async function createCycle(
  _prev: CreateCycleState,
  formData: FormData,
): Promise<CreateCycleState> {
  const admin = await requireAdmin();

  const base = createSchema.safeParse({
    annee: formData.get("annee"),
    seuil: formData.get("seuil"),
  });
  if (!base.success) {
    return { status: "error", message: "Année ou seuil invalide." };
  }
  const dateDebut = parseUtcDate(formData.get("dateDebut"));
  const dateFin = parseUtcDate(formData.get("dateFin"));
  const deadlinePreferences = parseUtcDate(formData.get("deadlinePreferences"));
  const deadlineVote = parseUtcDate(formData.get("deadlineVote"));

  if (!dateDebut || !dateFin || !deadlinePreferences || !deadlineVote) {
    return { status: "error", message: "Toutes les dates sont requises et valides." };
  }
  if (dateFin.getTime() <= dateDebut.getTime()) {
    return { status: "error", message: "La date de fin doit suivre la date de début." };
  }
  if (deadlineVote.getTime() < deadlinePreferences.getTime()) {
    return {
      status: "error",
      message: "La deadline de vote doit être postérieure à celle des préférences.",
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: admin.propertyId },
    select: { jourBascule: true },
  });
  if (!property) return { status: "error", message: "Bien introuvable." };

  const { slots } = computeWeekSlots(dateDebut, dateFin, property.jourBascule);
  if (slots.length === 0) {
    return {
      status: "error",
      message: "La période ne contient aucune semaine pleine.",
    };
  }

  // Un seul cycle actif à la fois par bien (spec section 3).
  const active = await getActiveCycle(admin.propertyId);
  if (active) {
    return {
      status: "error",
      message: `Un cycle est déjà en cours (${active.annee}). Clôturez-le avant d'en créer un nouveau.`,
    };
  }

  const families = await prisma.user.findMany({
    where: { propertyId: admin.propertyId, actif: true },
    select: { id: true },
  });

  try {
    await prisma.cycle.create({
      data: {
        propertyId: admin.propertyId,
        annee: base.data.annee,
        dateDebut,
        dateFin,
        deadlinePreferences,
        deadlineVote,
        seuilScoreMinimum: base.data.seuil,
        statut: "config",
        origine: "genere",
        weekSlots: {
          create: slots.map((s) => ({
            ordre: s.ordre,
            dateDebut: s.dateDebut,
            dateFin: s.dateFin,
          })),
        },
        // Droit par défaut : 1 semaine par famille active.
        familyRights: {
          create: families.map((f) => ({ userId: f.id, nombreSemaines: 1 })),
        },
      },
    });
  } catch {
    return {
      status: "error",
      message: `Un cycle existe déjà pour l'année ${base.data.annee}.`,
    };
  }

  revalidatePath("/admin");
  redirect("/admin");
}

// --- Édition des droits annuels ---------------------------------------------

export type SaveRightsState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveFamilyRights(
  _prev: SaveRightsState,
  formData: FormData,
): Promise<SaveRightsState> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { familyRights: true },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) {
    return { status: "error", message: "Cycle introuvable." };
  }
  if (cycle.statut !== "config") {
    return {
      status: "error",
      message: "Les droits ne sont modifiables qu'avant le lancement de la collecte.",
    };
  }

  // Applique les valeurs 1/2 par droit existant.
  const updates = cycle.familyRights.map((r) => {
    const raw = formData.get(`right_${r.userId}`);
    const n = raw === "2" ? 2 : 1;
    return prisma.familyRight.update({
      where: { id: r.id },
      data: { nombreSemaines: n },
    });
  });
  await prisma.$transaction(updates);

  revalidatePath("/admin");
  return { status: "saved", message: "Droits enregistrés." };
}

// --- Lancement de la collecte ------------------------------------------------

export type LaunchState = { status: "idle" | "error"; message?: string };

export async function launchCollection(
  _prev: LaunchState,
  formData: FormData,
): Promise<LaunchState> {
  const admin = await requireAdmin();
  const cycleId = String(formData.get("cycleId") ?? "");

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      familyRights: true,
      weekSlots: true,
      property: { include: { users: { where: { actif: true } } } },
    },
  });
  if (!cycle || cycle.propertyId !== admin.propertyId) {
    return { status: "error", message: "Cycle introuvable." };
  }
  if (cycle.statut !== "config") {
    return { status: "error", message: "La collecte a déjà été lancée." };
  }

  const coherence = checkCoherence(cycle.familyRights, cycle.weekSlots.length);
  if (!coherence.ok) {
    return {
      status: "error",
      message: `${coherence.totalRights} semaines de droits attribuées pour ${coherence.weekCount} semaines disponibles.`,
    };
  }

  // À partir d'ici, la période et le découpage sont verrouillés (spec section 4.1).
  await prisma.cycle.update({
    where: { id: cycle.id },
    data: { statut: "collecte" },
  });

  // Envoi de l'invitation à toutes les familles actives (échecs non bloquants).
  await Promise.allSettled(
    cycle.property.users.map((u) =>
      sendInvitationEmail(u.email, cycle.annee, cycle.deadlinePreferences),
    ),
  );

  revalidatePath("/admin");
  revalidatePath("/tableau-de-bord");
  redirect("/admin");
}
