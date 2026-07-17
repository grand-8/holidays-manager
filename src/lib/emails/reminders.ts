import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/emails/layout";

/**
 * Relances automatiques J-7 et J-3 avant une deadline (spec section 6, items 3
 * & 6). Envoyées uniquement aux familles n'ayant pas encore soumis / voté. Le
 * lien ouvre une page ; aucune action n'est déclenchée par le lien (section 9).
 */

function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Relance : préférences non encore soumises (section 6, item 3). */
export async function sendPreferenceReminderEmail(
  to: string,
  annee: number,
  deadline: Date,
  lieu: string,
) {
  const url = `${env.APP_URL}/preferences`;
  return sendEmail({
    to,
    subject: `${lieu} · Rappel — vos préférences vacances ${annee}`,
    html: renderEmail({
      accent: "amber",
      badge: "Rappel",
      lieu,
      titre: `Vacances ${annee} : il reste des préférences à saisir`,
      bodyHtml: `
        <p style="margin: 0 0 12px;">
          Vos préférences ne sont pas encore enregistrées. Pensez à les indiquer
          avant la date limite pour qu'elles soient prises en compte.
        </p>
        <p style="margin: 0;">Date limite&nbsp;: <strong>${formatDeadline(deadline)}</strong>.</p>`,
      cta: { label: "Saisir mes préférences", url },
    }),
  });
}

/** Relance : vote non encore exprimé (section 6, item 6). */
export async function sendVoteReminderEmail(
  to: string,
  annee: number,
  deadline: Date,
  lieu: string,
) {
  const url = `${env.APP_URL}/vote`;
  return sendEmail({
    to,
    subject: `${lieu} · Rappel — votez pour le planning ${annee}`,
    html: renderEmail({
      accent: "amber",
      badge: "Rappel",
      lieu,
      titre: `Vacances ${annee} : votre vote est attendu`,
      bodyHtml: `
        <p style="margin: 0 0 12px;">
          Vous n'avez pas encore voté pour l'une des propositions de planning.
          Votre voix compte pour arrêter le calendrier de l'année.
        </p>
        <p style="margin: 0;">Date limite&nbsp;: <strong>${formatDeadline(deadline)}</strong>.</p>`,
      cta: { label: "Voir les propositions et voter", url },
    }),
  });
}
