import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Client Resend, utilisé pour toutes les notifications email (spec section 6).
 * L'adresse d'envoi doit provenir d'un domaine vérifié dans Resend.
 */
export const resend = new Resend(env.RESEND_API_KEY);

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

/** Envoi générique d'un email transactionnel. */
export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    // On loggue sans exposer le contenu de l'email dans l'erreur remontée.
    console.error("[email] Échec d'envoi Resend:", error);
    throw new Error("L'envoi de l'email a échoué.");
  }

  return data;
}
