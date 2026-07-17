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
      ) : ctx.secondRoundLocked ? (
        <div className="rounded-lg border border-dashed p-6 text-sm">
          <p className="font-medium">Second tour en cours.</p>
          <p className="text-muted-foreground mt-1">
            Vos préférences sont verrouillées : seules les familles concernées
            par les semaines en tension peuvent les ajuster à ce tour. Le
            planning vous sera proposé une fois le second tour clôturé.
          </p>
        </div>
      ) : (
        <>
          {ctx.isSecondRound && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <p className="font-medium">Second tour — ajustez vos préférences</p>
              <p className="text-muted-foreground mt-1">
                Aucun planning satisfaisant n&apos;a été trouvé au premier tour.
                {ctx.tensionOrdres.length > 0 ? (
                  <>
                    {" "}
                    Les semaines suivantes sont très demandées par plusieurs
                    familles :{" "}
                    <span className="font-medium">
                      {ctx.tensionOrdres
                        .map((o) => {
                          const w = ctx.cycle.weekSlots.find(
                            (ws) => ws.ordre === o,
                          );
                          return w
                            ? new Date(w.dateDebut).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                timeZone: "UTC",
                              })
                            : null;
                        })
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    . Assouplir vos choix sur ces semaines aide à dégager une
                    solution équitable.
                  </>
                ) : (
                  " Vous pouvez assouplir vos choix pour aider à dégager une solution."
                )}
              </p>
            </div>
          )}
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
        </>
      )}
    </main>
  );
}
