import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/constants";

/**
 * Gestion des sessions serveur (spec section 2).
 * - Le cookie contient un jeton aléatoire ; la base ne stocke que son HMAC.
 * - Cookie httpOnly + secure + sameSite=strict, durée glissante de 30 jours.
 * - La déconnexion invalide la session CÔTÉ SERVEUR (suppression en base).
 */

const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

/** Options communes du cookie de session. */
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires,
  };
}

/**
 * Crée une session pour un utilisateur et pose le cookie.
 * À appeler uniquement depuis une Server Action / Route Handler.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/**
 * Retourne l'utilisateur de la session courante, ou null.
 * Renouvelle la date d'expiration en base (glissement) à chaque lecture valide.
 * Ne modifie PAS le cookie (interdit au rendu d'un Server Component) : le
 * glissement du cookie est assuré par le middleware.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  // Session expirée : on la supprime et on refuse l'accès.
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Compte désactivé : accès refusé (l'historique est préservé, spec section 2).
  if (!session.user.actif) return null;

  // Glissement côté serveur : on repousse l'expiration à 30 jours.
  const newExpiry = new Date(Date.now() + TTL_MS);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiry },
  });

  return session.user;
}

/**
 * Détruit la session courante côté serveur et supprime le cookie.
 * À appeler depuis une Server Action / Route Handler.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}
