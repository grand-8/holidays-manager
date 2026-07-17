import { sendEmail } from "@/lib/email";
import { OTP_TTL_MINUTES } from "@/lib/constants";

/**
 * Email de confirmation d'un changement d'adresse (spec section 2) : le code est
 * envoyé sur la NOUVELLE adresse, qui n'est appliquée qu'après sa validation.
 */
export async function sendEmailChangeOtp(to: string, code: string) {
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Confirmez votre nouvelle adresse</h1>
    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
      Vous avez demandé à utiliser cette adresse pour vous connecter à
      l'application des vacances familiales. Saisissez ce code pour la confirmer.
    </p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 0 0 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
      ${code}
    </p>
    <p style="font-size: 13px; color: #555; line-height: 1.5; margin: 0;">
      Ce code est valable ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à
      l'origine de cette demande, ignorez simplement cet email : votre adresse
      actuelle reste inchangée.
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: "Confirmez votre nouvelle adresse e-mail",
    html,
  });
}
