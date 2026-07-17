"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/current-user";
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from "@/lib/auth/otp";
import { OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS } from "@/lib/constants";
import { sendEmailChangeOtp } from "@/lib/emails/email-change";
import { logAudit } from "@/lib/audit";

/**
 * Changement d'adresse e-mail par l'utilisateur (spec section 2). En deux temps :
 * 1) demande → un code OTP est envoyé sur la NOUVELLE adresse ;
 * 2) confirmation → l'adresse n'est appliquée qu'après validation du code.
 * Contrôles côté serveur : unicité de l'email, expiration et tentatives du code.
 */

export type EmailChangeState = {
  status: "idle" | "sent" | "error" | "changed";
  message?: string;
  email?: string;
};

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z.string().trim().regex(/^\d{6}$/);

/** Étape 1 : demande de changement — envoie un code sur la nouvelle adresse. */
export async function requestEmailChange(
  _prev: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse(formData.get("newEmail"));
  if (!parsed.success) {
    return { status: "error", message: "Adresse e-mail invalide." };
  }
  const newEmail = parsed.data;

  if (newEmail === user.email) {
    return { status: "error", message: "C'est déjà votre adresse actuelle." };
  }
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return { status: "error", message: "Cette adresse n'est pas disponible." };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.pendingEmailChange.upsert({
    where: { userId: user.id },
    create: { userId: user.id, newEmail, codeHash: hashOtpCode(code), expiresAt },
    update: {
      newEmail,
      codeHash: hashOtpCode(code),
      expiresAt,
      tentatives: 0,
    },
  });

  try {
    await sendEmailChangeOtp(newEmail, code);
  } catch {
    return {
      status: "error",
      message: "L'envoi du code a échoué. Réessayez dans un instant.",
    };
  }

  return {
    status: "sent",
    email: newEmail,
    message: `Un code a été envoyé à ${newEmail}.`,
  };
}

/** Étape 2 : confirmation — applique la nouvelle adresse si le code est valide. */
export async function confirmEmailChange(
  _prev: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const user = await requireUser();
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    return { status: "error", message: "Code à 6 chiffres attendu." };
  }

  const pending = await prisma.pendingEmailChange.findUnique({
    where: { userId: user.id },
  });
  if (!pending) {
    return { status: "error", message: "Aucun changement en attente." };
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.pendingEmailChange.delete({ where: { userId: user.id } });
    return { status: "error", message: "Code expiré. Recommencez la demande." };
  }
  if (pending.tentatives >= OTP_MAX_ATTEMPTS) {
    return {
      status: "error",
      message: "Trop de tentatives. Recommencez la demande.",
    };
  }
  if (!verifyOtpCode(parsed.data, pending.codeHash)) {
    await prisma.pendingEmailChange.update({
      where: { userId: user.id },
      data: { tentatives: { increment: 1 } },
    });
    return { status: "error", message: "Code incorrect." };
  }

  // Dernière vérification d'unicité avant application.
  const stillTaken = await prisma.user.findUnique({
    where: { email: pending.newEmail },
  });
  if (stillTaken) {
    await prisma.pendingEmailChange.delete({ where: { userId: user.id } });
    return { status: "error", message: "Cette adresse n'est plus disponible." };
  }

  const oldEmail = user.email;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { email: pending.newEmail },
    });
    await tx.pendingEmailChange.delete({ where: { userId: user.id } });
    await logAudit(tx, {
      tableConcernee: "User",
      enregistrementId: user.id,
      champ: "email",
      ancienneValeur: oldEmail,
      nouvelleValeur: pending.newEmail,
      modifiePar: oldEmail,
    });
  });

  revalidatePath("/compte");
  return {
    status: "changed",
    email: pending.newEmail,
    message: "Votre adresse e-mail a été mise à jour.",
  };
}

/** Annule une demande de changement en attente. */
export async function cancelEmailChange(): Promise<void> {
  const user = await requireUser();
  await prisma.pendingEmailChange.deleteMany({ where: { userId: user.id } });
  revalidatePath("/compte");
}
