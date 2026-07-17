import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/emails/layout";

/**
 * Email : des semaines sont disponibles (spec section 6, item 9), suite à une
 * non-demande ou à un opt-out. Le lien ouvre la page des semaines non
 * réclamées ; aucune action n'est déclenchée par le lien (spec section 9).
 */
export async function sendUnclaimedWeeksEmail(
  to: string,
  annee: number,
  lieu: string,
) {
  const url = `${env.APP_URL}/semaines-libres`;
  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : des semaines sont disponibles`,
    html: renderEmail({
      accent: "blue",
      badge: "Semaines libres",
      lieu,
      titre: "Des semaines sont disponibles",
      bodyHtml: `
        <p style="margin: 0;">
          Une fois le planning ${annee} arrêté, certaines semaines n'ont été
          attribuées à aucune famille. Si l'une d'elles vous intéresse, vous
          pouvez le signaler ; l'administrateur tranchera ensuite les attributions.
        </p>`,
      cta: { label: "Voir les semaines disponibles", url },
    }),
  });
}
