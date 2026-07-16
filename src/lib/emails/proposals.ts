import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Email : les propositions de planning sont prêtes, lien vers le vote
 * (spec section 6, item 5). Le lien ouvre une page ; le vote lui-même se fait
 * par un clic explicite (spec section 9).
 */
export async function sendProposalsReadyEmail(to: string, annee: number) {
  const url = `${env.APP_URL}/vote`;
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Les plannings ${annee} sont prêts</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Les propositions de planning pour les vacances ${annee} sont disponibles.
      Consultez-les et votez pour celle qui vous convient le mieux.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Voir les propositions et voter
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: `Vacances ${annee} : les plannings sont prêts, à vous de voter`,
    html,
  });
}
