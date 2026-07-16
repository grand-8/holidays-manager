import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { getSessionUser } from "./session";

/**
 * Gardes d'accès CÔTÉ SERVEUR (spec section 2 & 34).
 * Toute vérification de droit passe par ici : l'interface n'est jamais une
 * barrière de sécurité. À utiliser dans les Server Components et Server Actions.
 */

/** Utilisateur courant, ou null si non connecté. */
export async function getCurrentUser(): Promise<User | null> {
  return getSessionUser();
}

/** Exige une session valide ; redirige vers /connexion sinon. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/** Exige un utilisateur admin ; redirige sinon. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/tableau-de-bord");
  return user;
}
