import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getFamilyStats, type FamilyStats } from "@/lib/stats/history";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Famille la plus en attente d'une année à 2 semaines (spec section 4.1). */
function priorityUserId(stats: FamilyStats[]): string | null {
  const active = stats.filter((s) => s.actif);
  if (active.length === 0) return null;
  const rank = (s: FamilyStats) =>
    s.timesWith2Weeks * 10_000 + (s.lastYearWith2Weeks ?? 0);
  return active.reduce((best, s) => (rank(s) < rank(best) ? s : best)).userId;
}

export default async function HistoriquePage() {
  const user = await requireUser();
  const stats = await getFamilyStats(user.propertyId);
  const prioId = priorityUserId(stats);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Historique &amp; statistiques
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Aide à la décision
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sur les 5 dernières années, visible par toutes les familles. Barre =
            satisfaction moyenne, pastilles = années à 2 semaines.
          </p>
        </div>
        {user.isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/import">Saisir / corriger</Link>
          </Button>
        )}
      </div>

      {prioId && (
        <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
          <span className="border-prio/40 text-prio bg-prio-bg rounded-full border px-2 py-0.5 font-semibold">
            Prioritaire 2 sem.
          </span>
          famille la plus en attente d&apos;une année à 2 semaines.
        </p>
      )}

      {stats.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <div className="text-muted-foreground mx-auto mb-4 grid size-12 place-items-center rounded-xl border">
            <CalendarX2 className="size-5" />
          </div>
          <h2 className="text-base font-semibold">Aucune donnée pour l&apos;instant</h2>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
            L&apos;historique se remplit à mesure des cycles clôturés.
            {user.isAdmin
              ? " Vous pouvez aussi importer les années passées."
              : ""}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border">
          {stats.map((s, i) => {
            const prio = s.userId === prioId;
            return (
              <div
                key={s.userId}
                className={cn(
                  "grid grid-cols-1 items-center gap-x-5 gap-y-2 border-l-2 border-transparent px-4 py-3.5 sm:grid-cols-[170px_1fr_150px]",
                  i > 0 && "border-t",
                  prio && "border-l-prio bg-prio-bg rounded-l-md",
                  !s.actif && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.nomAffiche}
                  {!s.actif && (
                    <span className="text-muted-foreground text-xs font-normal">
                      inactif
                    </span>
                  )}
                  {prio && (
                    <span className="border-prio/40 text-prio rounded-full border px-1.5 py-px text-[10px] font-semibold">
                      Prioritaire 2 sem.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-accent h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${s.avgSatisfaction ?? 0}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-11 text-right text-xs font-semibold tabular-nums">
                    {s.avgSatisfaction === null
                      ? "—"
                      : `${Math.round(s.avgSatisfaction)} %`}
                  </span>
                </div>

                <div className="text-muted-foreground flex items-center gap-2 text-xs sm:justify-end">
                  <span className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <span
                        key={k}
                        className={cn(
                          "size-2 rounded-full border",
                          k < s.timesWith2Weeks
                            ? "bg-foreground border-foreground"
                            : "border-input",
                        )}
                      />
                    ))}
                  </span>
                  {s.timesWith2Weeks}× · dern.{" "}
                  {s.lastYearWith2Weeks ?? "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground/70 mt-3 text-xs">
        « — » : aucune donnée. Les années importées ne comptent pas dans la
        satisfaction moyenne.
      </p>
    </main>
  );
}
