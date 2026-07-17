import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/emails/layout";

/**
 * Emails du mode de secours (spec section 6, item 8) : passage en second tour
 * ciblé ou en médiation. Les liens ouvrent une page ; aucune action n'est
 * déclenchée par le lien (spec section 9).
 */

export async function sendSecondRoundEmail(
  to: string,
  annee: number,
  lieu: string,
) {
  const url = `${env.APP_URL}/preferences`;
  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : second tour de préférences`,
    html: renderEmail({
      accent: "amber",
      badge: "Second tour",
      lieu,
      titre: `Second tour — vacances ${annee}`,
      bodyHtml: `
        <p style="margin: 0;">
          Aucun planning satisfaisant n'a pu être établi au premier tour.
          Certaines semaines sont très demandées&nbsp;: nous vous invitons à
          ajuster vos préférences pour aider à dégager une solution équitable.
        </p>`,
      cta: { label: "Ajuster mes préférences", url },
    }),
  });
}

export async function sendMediationEmail(
  to: string,
  annee: number,
  lieu: string,
) {
  const url = `${env.APP_URL}/tableau-de-bord`;
  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : passage en médiation`,
    html: renderEmail({
      accent: "red",
      badge: "Médiation",
      lieu,
      titre: `Médiation — vacances ${annee}`,
      bodyHtml: `
        <p style="margin: 0;">
          Le second tour n'a pas permis d'aboutir automatiquement.
          L'administrateur va arbitrer manuellement la répartition des semaines.
          Vous serez informé·e du planning retenu et de sa justification.
        </p>`,
      cta: { label: "Ouvrir mon espace", url },
    }),
  });
}
