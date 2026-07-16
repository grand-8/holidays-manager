import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/auth/actions";
import { getActiveCycle } from "@/lib/cycles/service";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUT_LABELS: Record<string, string> = {
  config: "En préparation",
  collecte: "Collecte des préférences en cours",
  collecte_tour2: "Second tour en cours",
  generation: "Génération des plannings",
  vote: "Vote en cours",
  mediation: "Médiation",
};

export default async function DashboardPage() {
  // Garde d'accès côté serveur : redirige vers /connexion si non authentifié.
  const user = await requireUser();
  const cycle = await getActiveCycle(user.propertyId);

  // Statut de réponse de la famille pour l'encart d'appel à l'action.
  const collecte =
    cycle && (cycle.statut === "collecte" || cycle.statut === "collecte_tour2");
  const [right, optOut] = collecte
    ? await Promise.all([
        prisma.familyRight.findUnique({
          where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        }),
        prisma.optOut.findUnique({
          where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        }),
      ])
    : [null, null];
  const aRepondu = optOut !== null || (right?.soumisLe ?? null) !== null;

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
        <div className="flex items-center gap-2">
          {user.isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Administration</Link>
            </Button>
          )}
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-8">
        {!cycle ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            Aucun cycle de vacances en cours pour le moment.
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vacances {cycle.annee}</CardTitle>
              <CardDescription>
                {STATUT_LABELS[cycle.statut] ?? cycle.statut}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {collecte ? (
                <>
                  <p className="text-sm">
                    {aRepondu
                      ? "Vous avez répondu ✅ — vous pouvez encore modifier vos préférences jusqu'à la clôture."
                      : "Vous n'avez pas encore renseigné vos préférences."}
                  </p>
                  <Button asChild>
                    <Link href="/preferences">
                      {aRepondu ? "Modifier mes préférences" : "Saisir mes préférences"}
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  La saisie des préférences n&apos;est pas ouverte actuellement.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
