import { sendEmail } from "@/lib/email";
import { OTP_TTL_MINUTES } from "@/lib/constants";
import { renderEmail } from "@/lib/emails/layout";

/** Email contenant le code OTP de connexion (spec section 6, item 1). */
export async function sendOtpEmail(
  to: string,
  code: string,
  lieu = "Vacances familiales",
) {
  const body = `
    <p style="margin: 0 0 14px;">
      Utilisez ce code pour vous connecter à votre espace de gestion des vacances.
    </p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 0 0 14px; color: #18181b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
      ${code}
    </p>
    <p style="font-size: 13px; color: #71717a; line-height: 1.5; margin: 0;">
      Ce code est valable ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine
      de cette demande, ignorez simplement cet email.
    </p>`;

  return sendEmail({
    to,
    subject: `${lieu} · Votre code de connexion`,
    html: renderEmail({
      accent: "neutral",
      badge: "Connexion",
      lieu,
      titre: "Votre code de connexion",
      bodyHtml: body,
    }),
  });
}
