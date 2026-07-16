import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  // Garde d'accès côté serveur : redirige vers /connexion si non authentifié.
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm">
            Connecté en tant que {user.nomAffiche}
            {user.isAdmin ? " (admin)" : ""}.
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Se déconnecter
          </Button>
        </form>
      </div>

      <div className="text-muted-foreground mt-8 rounded-lg border border-dashed p-8 text-center text-sm">
        Le cycle en cours, le formulaire de préférences et le vote apparaîtront
        ici. (En cours de construction.)
      </div>
    </main>
  );
}
