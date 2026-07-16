import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Email d'ouverture du cycle : invitation à saisir les préférences
 * (spec section 6, item 2). Le lien ouvre une page ; aucune action n'est
 * déclenchée directement par le lien (spec section 9).
 */
export async function sendInvitationEmail(
  to: string,
  annee: number,
  deadline: Date | null,
) {
  const url = `${env.APP_URL}/tableau-de-bord`;
  const deadlineTxt = deadline
    ? `Merci de répondre avant le ${deadline.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}.`
    : "";

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Vacances ${annee} : à vous de jouer</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      La collecte des préférences pour les vacances ${annee} est ouverte.
      Indiquez les semaines qui vous conviennent le mieux depuis votre espace.
      ${deadlineTxt}
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Saisir mes préférences
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: `Vacances ${annee} : saisissez vos préférences`,
    html,
  });
}
