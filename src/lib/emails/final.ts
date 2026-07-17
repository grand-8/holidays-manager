import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/emails/layout";

/**
 * Email : planning final confirmé (spec section 6, item 7). Le lien ouvre la
 * page de résultat ; aucune action n'est déclenchée par le lien (spec section 9).
 */
export async function sendFinalScheduleEmail(
  to: string,
  annee: number,
  lieu: string,
) {
  const url = `${env.APP_URL}/vote`;
  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : planning final confirmé`,
    html: renderEmail({
      accent: "green",
      badge: "Planning confirmé",
      lieu,
      titre: `Planning ${annee} confirmé`,
      bodyHtml: `
        <p style="margin: 0;">
          La répartition des semaines de vacances ${annee} est arrêtée. Vous
          pouvez consulter le planning retenu depuis votre espace.
        </p>`,
      cta: { label: "Voir le planning retenu", url },
    }),
  });
}
