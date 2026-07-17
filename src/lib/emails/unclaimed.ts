import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Email : des semaines sont disponibles (spec section 6, item 9), suite à une
 * non-demande ou à un opt-out. Le lien ouvre la page des semaines non
 * réclamées ; aucune action n'est déclenchée par le lien (spec section 9).
 */
export async function sendUnclaimedWeeksEmail(to: string, annee: number) {
  const url = `${env.APP_URL}/semaines-libres`;
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Des semaines sont disponibles</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Une fois le planning ${annee} arrêté, certaines semaines n'ont été
      attribuées à aucune famille. Si l'une d'elles vous intéresse, vous pouvez
      le signaler ; l'administrateur tranchera ensuite les attributions.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Voir les semaines disponibles
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;

  return sendEmail({
    to,
    subject: `Vacances ${annee} : des semaines sont disponibles`,
    html,
  });
}
