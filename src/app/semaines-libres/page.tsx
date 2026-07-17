import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getUnclaimedData } from "@/lib/unclaimed/service";
import { assignFreeWeek, unassignFreeWeek } from "@/lib/unclaimed/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InterestButton } from "./interest-button";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default async function UnclaimedPage() {
  const user = await requireUser();
  const data = await getUnclaimedData(user.propertyId, user.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Semaines disponibles</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tableau-de-bord">← Tableau de bord</Link>
        </Button>
      </div>

      {!data ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Aucun planning n&apos;a encore été décidé. Les semaines disponibles
          apparaîtront ici une fois la répartition arrêtée.
        </div>
      ) : data.weeks.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Toutes les semaines de {data.annee} ont été attribuées. Aucune semaine
          disponible.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Ces semaines de {data.annee}
            {" "}
            n&apos;ont été attribuées à aucune famille. Manifestez votre
            intérêt&nbsp;; l&apos;administrateur
            tranche ensuite les attributions.
          </p>
          {data.weeks.map((w) => (
            <Card key={w.weekSlotId}>
              <CardHeader>
                <CardTitle className="text-base">
                  Du {fmt(w.dateDebut)} au {fmt(w.dateFin)}
                </CardTitle>
                <CardDescription>
                  {w.assignedTo
                    ? `Attribuée à ${w.assignedTo.nomAffiche}.`
                    : w.interested.length > 0
                      ? `Intéressé·es : ${w.interested.map((f) => f.nomAffiche).join(", ")}.`
                      : "Aucune famille intéressée pour l'instant."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {w.assignedTo ? (
                  user.isAdmin && (
                    <form action={unassignFreeWeek}>
                      <input type="hidden" name="cycleId" value={data.cycleId} />
                      <input
                        type="hidden"
                        name="weekSlotId"
                        value={w.weekSlotId}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Retirer l&apos;attribution
                      </Button>
                    </form>
                  )
                ) : (
                  <>
                    <InterestButton
                      weekSlotId={w.weekSlotId}
                      interested={w.iAmInterested}
                    />
                    {user.isAdmin && w.interested.length > 0 && (
                      <form
                        action={assignFreeWeek}
                        className="flex flex-wrap items-center gap-2 border-t pt-3"
                      >
                        <input
                          type="hidden"
                          name="cycleId"
                          value={data.cycleId}
                        />
                        <input
                          type="hidden"
                          name="weekSlotId"
                          value={w.weekSlotId}
                        />
                        <select
                          name="userId"
                          defaultValue={w.interested[0].userId}
                          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                        >
                          {w.interested.map((f) => (
                            <option key={f.userId} value={f.userId}>
                              {f.nomAffiche}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="secondary">
                          Attribuer
                        </Button>
                      </form>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
