import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getPreferencesContext } from "@/lib/preferences/service";
import { Button } from "@/components/ui/button";
import { PreferencesForm } from "./preferences-form";

export default async function PreferencesPage() {
  const user = await requireUser();
  const ctx = await getPreferencesContext(user.id, user.propertyId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mes préférences</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tableau-de-bord">← Tableau de bord</Link>
        </Button>
      </div>

      {!ctx || !ctx.right ? (
        <p className="text-muted-foreground text-sm">
          Aucune collecte de préférences n&apos;est en cours pour le moment.
        </p>
      ) : (
        <PreferencesForm
          // Remonte le formulaire quand l'état persisté change (après sauvegarde),
          // pour que les sélecteurs contrôlés reflètent la base.
          key={[
            ctx.optOut ? "opt" : "in",
            ctx.right.soumisLe?.getTime() ?? 0,
            ctx.prefs
              .map((p) => `${p.weekSlotId}:${p.statut}`)
              .sort()
              .join(","),
          ].join("|")}
          annee={ctx.cycle.annee}
          nombreSemaines={ctx.right.nombreSemaines}
          accepteFractionnement={ctx.right.accepteFractionnement}
          hasAnswered={ctx.right.soumisLe !== null}
          optedOut={ctx.optOut !== null}
          weeks={ctx.cycle.weekSlots.map((w) => ({
            id: w.id,
            ordre: w.ordre,
            dateDebut: w.dateDebut.toISOString(),
            dateFin: w.dateFin.toISOString(),
          }))}
          prefs={Object.fromEntries(
            ctx.prefs.map((p) => [p.weekSlotId, p.statut]),
          )}
        />
      )}
    </main>
  );
}
