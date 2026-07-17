/**
 * Gabarit d'email partagé (spec section 6). Toutes les notifications passent par
 * `renderEmail` pour un rendu cohérent ET différencié : chaque type d'alerte a
 * un accent de couleur et une pastille (badge) qui le rendent reconnaissable au
 * premier coup d'œil, et le nom du lieu loué apparaît en en-tête.
 */

export type EmailAccent = "neutral" | "green" | "amber" | "blue" | "red";

type AccentPalette = {
  bar: string;
  badgeBg: string;
  badgeText: string;
  button: string;
};

const ACCENTS: Record<EmailAccent, AccentPalette> = {
  neutral: { bar: "#71717a", badgeBg: "#f4f4f5", badgeText: "#3f3f46", button: "#18181b" },
  green: { bar: "#16a34a", badgeBg: "#dcfce7", badgeText: "#15803d", button: "#16a34a" },
  amber: { bar: "#d97706", badgeBg: "#fef3c7", badgeText: "#b45309", button: "#b45309" },
  blue: { bar: "#2563eb", badgeBg: "#dbeafe", badgeText: "#1d4ed8", button: "#2563eb" },
  red: { bar: "#dc2626", badgeBg: "#fee2e2", badgeText: "#b91c1c", button: "#b91c1c" },
};

/** Échappe le texte injecté dans le HTML (nom du lieu, libellés dynamiques). */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmail({
  accent,
  badge,
  lieu,
  titre,
  bodyHtml,
  cta,
}: {
  accent: EmailAccent;
  /** Pastille de catégorie, ex. « Rappel », « Invitation ». */
  badge: string;
  /** Nom du lieu loué, affiché en en-tête. */
  lieu: string;
  titre: string;
  /** Corps déjà en HTML (paragraphes, blocs spécifiques). */
  bodyHtml: string;
  cta?: { label: string; url: string } | null;
}): string {
  const c = ACCENTS[accent];
  const ctaHtml = cta
    ? `
    <tr><td style="padding: 4px 24px 4px;">
      <a href="${cta.url}" style="display: inline-block; background: ${c.button}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 11px 20px; border-radius: 8px;">
        ${esc(cta.label)}
      </a>
    </td></tr>
    <tr><td style="padding: 12px 24px 4px;">
      <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.5;">
        Si le bouton ne fonctionne pas, copiez ce lien&nbsp;: ${cta.url}
      </p>
    </td></tr>`
    : "";

  return `
  <div style="background: #f4f4f5; padding: 24px 12px; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e4e4e7;">
      <tr><td style="height: 4px; background: ${c.bar};"></td></tr>
      <tr><td style="padding: 22px 24px 0;">
        <p style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #a1a1aa;">
          🏡 ${esc(lieu)}
        </p>
        <span style="display: inline-block; margin: 12px 0 0; padding: 3px 10px; border-radius: 999px; background: ${c.badgeBg}; color: ${c.badgeText}; font-size: 12px; font-weight: 600;">
          ${esc(badge)}
        </span>
      </td></tr>
      <tr><td style="padding: 14px 24px 0;">
        <h1 style="font-size: 19px; line-height: 1.3; margin: 0 0 4px; color: #18181b;">${esc(titre)}</h1>
      </td></tr>
      <tr><td style="padding: 8px 24px 4px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
        ${bodyHtml}
      </td></tr>
      ${ctaHtml}
      <tr><td style="padding: 22px 24px 24px;">
        <p style="font-size: 12px; color: #a1a1aa; margin: 0; line-height: 1.5; border-top: 1px solid #f0f0f1; padding-top: 14px;">
          Message automatique de l'application de gestion des vacances — ${esc(lieu)}.
        </p>
      </td></tr>
    </table>
  </div>`;
}
