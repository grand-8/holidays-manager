import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

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

function reminderHtml({
  titre,
  intro,
  deadline,
  cta,
  url,
}: {
  titre: string;
  intro: string;
  deadline: Date;
  cta: string;
  url: string;
}): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">${titre}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">${intro}</p>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Date limite : <strong>${formatDeadline(deadline)}</strong>.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        ${cta}
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;
}

/** Relance : préférences non encore soumises (section 6, item 3). */
export async function sendPreferenceReminderEmail(
  to: string,
  annee: number,
  deadline: Date,
) {
  const url = `${env.APP_URL}/preferences`;
  return sendEmail({
    to,
    subject: `Rappel — vos préférences vacances ${annee}`,
    html: reminderHtml({
      titre: `Vacances ${annee} : il reste des préférences à saisir`,
      intro:
        "Vos préférences ne sont pas encore enregistrées. Pensez à les indiquer avant la date limite pour qu'elles soient prises en compte.",
      deadline,
      cta: "Saisir mes préférences",
      url,
    }),
  });
}

/** Relance : vote non encore exprimé (section 6, item 6). */
export async function sendVoteReminderEmail(
  to: string,
  annee: number,
  deadline: Date,
) {
  const url = `${env.APP_URL}/vote`;
  return sendEmail({
    to,
    subject: `Rappel — votez pour le planning ${annee}`,
    html: reminderHtml({
      titre: `Vacances ${annee} : votre vote est attendu`,
      intro:
        "Vous n'avez pas encore voté pour l'une des propositions de planning. Votre voix compte pour arrêter le calendrier de l'année.",
      deadline,
      cta: "Voir les propositions et voter",
      url,
    }),
  });
}
