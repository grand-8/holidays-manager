import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveCycle, getCompletion } from "@/lib/cycles/service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SuiviPage() {
  const user = await requireUser();
  const cycle = await getActiveCycle(user.propertyId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suivi des réponses</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tableau-de-bord">← Tableau de bord</Link>
        </Button>
      </div>

      {!cycle ? (
        <p className="text-muted-foreground text-sm">
          Aucun cycle en cours.
        </p>
      ) : (
        <SuiviList cycleId={cycle.id} propertyId={user.propertyId} annee={cycle.annee} />
      )}
    </main>
  );
}

async function SuiviList({
  cycleId,
  propertyId,
  annee,
}: {
  cycleId: string;
  propertyId: string;
  annee: number;
}) {
  const rows = await getCompletion(cycleId, propertyId);
  const done = rows.filter((r) => r.responded).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vacances {annee}</CardTitle>
        <CardDescription>
          {done} / {rows.length} famille{rows.length > 1 ? "s" : ""} ont répondu.
          Le détail des préférences reste masqué jusqu&apos;à la génération.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between py-2">
              <span className="text-sm">{r.nomAffiche}</span>
              <span className="text-sm">
                {r.responded ? (
                  <span className="text-green-600 dark:text-green-500">
                    Répondu&nbsp;✅{r.optedOut ? " (ne participe pas)" : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">En attente&nbsp;⏳</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
