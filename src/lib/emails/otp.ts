import { sendEmail } from "@/lib/email";
import { OTP_TTL_MINUTES } from "@/lib/constants";

/** Email contenant le code OTP de connexion (spec section 6, item 1). */
export async function sendOtpEmail(to: string, code: string) {
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Votre code de connexion</h1>
    <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
      Utilisez ce code pour vous connecter à l'application des vacances familiales.
    </p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 0 0 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
      ${code}
    </p>
    <p style="font-size: 13px; color: #555; line-height: 1.5; margin: 0;">
      Ce code est valable ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine
      de cette demande, ignorez simplement cet email.
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: "Votre code de connexion",
    html,
  });
}
