import { getCurrentUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/app-shell";

/**
 * Layout des pages authentifiées : coque applicative commune (nav persistante).
 * Le contrôle d'accès reste porté par chaque page (`requireUser`/`requireAdmin`) ;
 * ici on ne fait que fournir le cadre. `getCurrentUser` peut être null le temps
 * qu'une page non authentifiée redirige.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <AppShell
      user={
        user
          ? {
              nomAffiche: user.nomAffiche,
              email: user.email,
              isAdmin: user.isAdmin,
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
