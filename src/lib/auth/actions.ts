"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  OTP_IP_REQUEST_MAX,
  OTP_IP_VERIFY_MAX,
  OTP_IP_WINDOW_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_REQUEST_MAX,
  OTP_REQUEST_WINDOW_MINUTES,
  OTP_TTL_MINUTES,
} from "@/lib/constants";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./otp";
import { createSession, destroySession } from "./session";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/emails/otp";

/**
 * Server Actions d'authentification (spec section 2).
 * Rappel sécurité : ces fonctions sont atteignables par POST direct — la
 * validation et les contrôles sont donc faits ici, côté serveur, systématiquement.
 */

// --- Demande d'un code -------------------------------------------------------

export type RequestOtpState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Envoie un code OTP à l'email fourni.
 * Non-divulgation (spec section 2) : la réponse est identique que l'email
 * corresponde ou non à un compte. Anti-abus : max 3 demandes / 15 min / email.
 * Toute nouvelle demande invalide les codes précédents du compte.
 */
export async function requestOtp(
  _prev: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Adresse email invalide." };
  }
  const email = parsed.data;

  // Réponse générique commune, quelle que soit l'issue réelle.
  const generic: RequestOtpState = {
    status: "sent",
    email,
    message:
      "Si cette adresse correspond à un compte, un code vient d'être envoyé.",
  };

  // Anti-abus PAR IP (R4), avant tout accès base : borne le spraying et l'abus
  // d'e-mail. Réponse générique en cas de blocage (aucune divulgation).
  const ip = await getClientIp();
  const allowed = await rateLimit(
    `otp_request:${ip}`,
    OTP_IP_REQUEST_MAX,
    OTP_IP_WINDOW_MINUTES * 60 * 1000,
  );
  if (!allowed) return generic;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { property: { select: { nom: true } } },
  });
  if (!user || !user.actif) {
    return generic; // ne pas révéler l'absence/l'inactivité du compte
  }

  // Anti-abus : nombre de demandes récentes.
  const windowStart = new Date(
    Date.now() - OTP_REQUEST_WINDOW_MINUTES * 60 * 1000,
  );
  const recentCount = await prisma.otpCode.count({
    where: { userId: user.id, createdAt: { gte: windowStart } },
  });
  if (recentCount >= OTP_REQUEST_MAX) {
    return generic; // silencieux, sans révéler le blocage
  }

  // Invalide tous les codes encore valides, puis en crée un nouveau.
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { userId: user.id, consumed: false },
      data: { consumed: true },
    }),
    prisma.otpCode.create({
      data: { userId: user.id, codeHash: hashOtpCode(code), expiresAt },
    }),
  ]);

  try {
    await sendOtpEmail(email, code, user.property.nom);
  } catch {
    // On ne révèle pas l'échec d'envoi à l'utilisateur non plus.
    return generic;
  }

  return generic;
}

// --- Vérification d'un code --------------------------------------------------

export type VerifyOtpState = {
  status: "idle" | "error";
  message?: string;
};

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

/**
 * Vérifie le code et ouvre une session en cas de succès.
 * Expiration 10 min, 5 tentatives max (spec section 2). Messages volontairement
 * peu bavards pour ne pas révéler l'existence d'un compte.
 */
export async function verifyOtp(
  _prev: VerifyOtpState,
  formData: FormData,
): Promise<VerifyOtpState> {
  const invalid: VerifyOtpState = {
    status: "error",
    message: "Code invalide ou expiré. Demandez un nouveau code si besoin.",
  };

  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Code à 6 chiffres attendu." };
  }
  const { email, code } = parsed.data;

  // Anti-abus PAR IP (R4) : borne le brute-force réparti sur plusieurs comptes
  // depuis une même IP. Complète le plafond de 5 tentatives par code.
  const ip = await getClientIp();
  const allowed = await rateLimit(
    `otp_verify:${ip}`,
    OTP_IP_VERIFY_MAX,
    OTP_IP_WINDOW_MINUTES * 60 * 1000,
  );
  if (!allowed) return invalid;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.actif) return invalid;

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return invalid;

  // Expiré → on le consomme.
  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });
    return invalid;
  }

  // Trop de tentatives déjà → on le consomme, nouveau code obligatoire.
  if (otp.tentatives >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });
    return {
      status: "error",
      message: "Trop de tentatives. Demandez un nouveau code.",
    };
  }

  if (!verifyOtpCode(code, otp.codeHash)) {
    const attempts = otp.tentatives + 1;
    const reachedMax = attempts >= OTP_MAX_ATTEMPTS;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { tentatives: attempts, consumed: reachedMax },
    });
    const remaining = OTP_MAX_ATTEMPTS - attempts;
    return {
      status: "error",
      message: reachedMax
        ? "Trop de tentatives. Demandez un nouveau code."
        : `Code incorrect. ${remaining} tentative(s) restante(s).`,
    };
  }

  // Succès : on consomme le code et on ouvre la session.
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumed: true },
  });
  await createSession(user.id);

  // redirect() lève une exception de contrôle : hors de tout try/catch.
  redirect("/tableau-de-bord");
}

// --- Déconnexion -------------------------------------------------------------

/** Déconnexion explicite : invalide la session côté serveur (spec section 2). */
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/connexion");
}
