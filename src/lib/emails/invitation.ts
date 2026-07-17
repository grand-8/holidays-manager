import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail, esc } from "@/lib/emails/layout";

/**
 * Email d'ouverture du cycle : invitation à saisir les préférences
 * (spec section 6, item 2). Le lien ouvre une page ; aucune action n'est
 * déclenchée directement par le lien (spec section 9).
 */
export async function sendInvitationEmail(
  to: string,
  annee: number,
  deadline: Date | null,
  lieu: string,
) {
  const url = `${env.APP_URL}/preferences`;
  const deadlineTxt = deadline
    ? `<p style="margin: 12px 0 0;">Merci de répondre avant le <strong>${deadline.toLocaleDateString(
        "fr-FR",
        { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
      )}</strong>.</p>`
    : "";

  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : saisissez vos préférences`,
    html: renderEmail({
      accent: "green",
      badge: "Invitation",
      lieu,
      titre: `Vacances ${annee} : à vous de jouer`,
      bodyHtml: `
        <p style="margin: 0;">
          La collecte des préférences pour <strong>${esc(lieu)}</strong> (${annee}) est
          ouverte. Indiquez depuis votre espace les semaines qui vous conviennent
          le mieux.
        </p>
        ${deadlineTxt}`,
      cta: { label: "Saisir mes préférences", url },
    }),
  });
}
