import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Email : planning final confirmé (spec section 6, item 7). Le lien ouvre la
 * page de résultat ; aucune action n'est déclenchée par le lien (spec section 9).
 */
export async function sendFinalScheduleEmail(to: string, annee: number) {
  const url = `${env.APP_URL}/vote`;
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Planning ${annee} confirmé</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      La répartition des semaines de vacances ${annee} est arrêtée. Vous pouvez
      consulter le planning retenu depuis votre espace.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Voir le planning retenu
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: `Vacances ${annee} : planning final confirmé`,
    html,
  });
}
