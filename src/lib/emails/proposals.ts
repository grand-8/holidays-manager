import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { renderEmail } from "@/lib/emails/layout";

/**
 * Email : les propositions de planning sont prêtes, lien vers le vote
 * (spec section 6, item 5). Le lien ouvre une page ; le vote lui-même se fait
 * par un clic explicite (spec section 9).
 */
export async function sendProposalsReadyEmail(
  to: string,
  annee: number,
  lieu: string,
) {
  const url = `${env.APP_URL}/vote`;
  return sendEmail({
    to,
    subject: `${lieu} · Vacances ${annee} : les plannings sont prêts, à vous de voter`,
    html: renderEmail({
      accent: "blue",
      badge: "Vote ouvert",
      lieu,
      titre: `Les plannings ${annee} sont prêts`,
      bodyHtml: `
        <p style="margin: 0;">
          Les propositions de planning pour les vacances ${annee} sont
          disponibles. Comparez-les et votez pour celle qui vous convient le mieux.
        </p>`,
      cta: { label: "Voir les propositions et voter", url },
    }),
  });
}
