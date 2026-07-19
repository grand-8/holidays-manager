import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Limitation de débit par IP (audit sécurité R4 / OWASP A07).
 *
 * L'état vit en base (modèle `RateLimitHit`) plutôt qu'en mémoire : en serverless
 * (Vercel) chaque invocation peut tourner sur une instance différente, donc un
 * compteur en mémoire ne protégerait rien. Ici, toutes les instances partagent
 * le même compteur via Neon.
 *
 * Ce mécanisme COMPLÈTE les limites par compte déjà en place (spec section 2) ;
 * il ne les remplace pas.
 */

/**
 * IP cliente de la requête courante. Sur Vercel, l'IP réelle est en tête de
 * `x-forwarded-for` (la plateforme la place et la maîtrise). Repli sur
 * `x-real-ip`, puis une valeur constante (limite alors globale, fail-safe).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Consomme une unité de débit pour `bucket`. Retourne `true` si l'action est
 * autorisée (sous le plafond), `false` si la limite est atteinte.
 *
 * Fenêtre glissante simple : on purge d'abord les hits hors fenêtre (housekeeping
 * borné), on compte ceux qui restent, puis on enregistre le hit courant s'il est
 * autorisé. La légère course possible entre `count` et `create` est acceptable
 * pour du rate-limiting (on tolère un dépassement marginal).
 */
export async function rateLimit(
  bucket: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);

  try {
    await prisma.rateLimitHit.deleteMany({
      where: { bucket, createdAt: { lt: since } },
    });
    const count = await prisma.rateLimitHit.count({
      where: { bucket, createdAt: { gte: since } },
    });
    if (count >= max) return false;
    await prisma.rateLimitHit.create({ data: { bucket } });
    return true;
  } catch {
    // En cas d'échec du limiteur (ex. base indisponible), on n'empêche pas la
    // connexion légitime : les limites PAR COMPTE restent la barrière dure.
    return true;
  }
}
