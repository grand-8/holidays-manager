import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Emails du mode de secours (spec section 6, item 8) : passage en second tour
 * ciblé ou en médiation. Les liens ouvrent une page ; aucune action n'est
 * déclenchée par le lien (spec section 9).
 */

export async function sendSecondRoundEmail(to: string, annee: number) {
  const url = `${env.APP_URL}/preferences`;
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Second tour — vacances ${annee}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Aucun planning satisfaisant n'a pu être établi au premier tour. Certaines
      semaines sont très demandées&nbsp;: nous vous invitons à ajuster vos
      préférences pour aider à dégager une solution équitable.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Ajuster mes préférences
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;
  return sendEmail({
    to,
    subject: `Vacances ${annee} : second tour de préférences`,
    html,
  });
}

export async function sendMediationEmail(to: string, annee: number) {
  const url = `${env.APP_URL}/tableau-de-bord`;
  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Médiation — vacances ${annee}</h1>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Le second tour n'a pas permis d'aboutir automatiquement. L'administrateur
      va arbitrer manuellement la répartition des semaines. Vous serez informé·e
      du planning retenu et de sa justification.
    </p>
    <p style="margin: 0 0 20px;">
      <a href="${url}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-size: 14px; padding: 10px 18px; border-radius: 8px;">
        Ouvrir mon espace
      </a>
    </p>
    <p style="font-size: 12px; color: #777; margin: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien : ${url}
    </p>
  </div>`;
  return sendEmail({
    to,
    subject: `Vacances ${annee} : passage en médiation`,
    html,
  });
}
