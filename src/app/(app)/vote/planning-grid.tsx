import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type GridWeek = { ordre: number; dateDebut: string; dateFin: string };
export type GridFamily = {
  userId: string;
  nomAffiche: string;
  /** Ordres des semaines attribuées à cette famille dans la proposition. */
  assigned: number[];
  /** Score individuel — affiché uniquement pour la famille courante (§4.6). */
  score: number | null;
};

/** En-têtes de colonnes : jour + mois affiché une seule fois par mois. */
function columns(weeks: GridWeek[]) {
  let prevMon: string | null = null;
  return weeks.map((w) => {
    const d = new Date(w.dateDebut);
    const day = d.getUTCDate();
    const mon = d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
    const showMon = mon !== prevMon;
    prevMon = mon;
    return { ordre: w.ordre, code: `S${w.ordre + 1}`, day, mon, showMon };
  });
}

function prefBg(statut: string | undefined): string {
  switch (statut) {
    case "preferee":
      return "bg-pref-bg";
    case "alternative":
      return "bg-alt-bg";
    case "impossible":
      return "bg-imp-bg";
    default:
      return "";
  }
}

function satTone(score: number): string {
  if (score >= 95) return "bg-good";
  if (score >= 60) return "bg-warn";
  return "bg-bad";
}

/**
 * Matrice familles × semaines (spec section 4.5/4.6). Le ✓ marque la semaine
 * attribuée à chaque famille. Confidentialité : seule la ligne de la famille
 * courante est colorée par ses préférences, et seul son score est affiché.
 */
export function PlanningGrid({
  weeks,
  families,
  myUserId,
  myPrefs,
}: {
  weeks: GridWeek[];
  families: GridFamily[];
  myUserId: string;
  myPrefs: Record<number, string>;
}) {
  const cols = columns(weeks);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-0">
        <colgroup>
          <col className="w-[150px]" />
          {cols.map((c) => (
            <col key={c.ordre} />
          ))}
          <col className="w-[116px]" />
        </colgroup>
        <thead>
          <tr>
            <th className="border-b px-1.5 pb-2.5 text-left text-xs font-medium">
              Famille
            </th>
            {cols.map((c) => (
              <th key={c.ordre} className="border-b px-1 pb-2.5 text-center">
                <div className="text-muted-foreground/70 text-[10px] font-semibold tracking-wide">
                  {c.code}
                </div>
                <div className="text-xs font-semibold">
                  {c.day}
                  {c.showMon && (
                    <span className="text-muted-foreground font-medium">
                      {" "}
                      {c.mon}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th className="border-b px-1 pb-2.5 text-center text-xs font-medium">
              Satisfaction
            </th>
          </tr>
        </thead>
        <tbody>
          {families.map((f) => {
            const isMine = f.userId === myUserId;
            const assigned = new Set(f.assigned);
            return (
              <tr key={f.userId}>
                <td className="border-b px-1.5 align-middle">
                  <div className="truncate text-sm font-medium">
                    {f.nomAffiche}
                    {isMine && (
                      <span className="text-muted-foreground"> (vous)</span>
                    )}
                  </div>
                  <div className="text-muted-foreground/70 text-[11px]">
                    {f.assigned.length} semaine
                    {f.assigned.length > 1 ? "s" : ""}
                  </div>
                </td>
                {cols.map((c) => {
                  const isAssigned = assigned.has(c.ordre);
                  const tint = isMine ? prefBg(myPrefs[c.ordre]) : "";
                  return (
                    <td key={c.ordre} className="p-0">
                      <div
                        className={cn(
                          "m-[3px] grid h-11 place-items-center rounded-md border border-transparent",
                          tint,
                          isAssigned && "border-foreground",
                        )}
                      >
                        {isAssigned ? (
                          <span className="bg-foreground text-background grid size-4 place-items-center rounded">
                            <Check className="size-3" strokeWidth={3.5} />
                          </span>
                        ) : (
                          !tint && (
                            <span className="bg-neutral-dot size-1 rounded-full" />
                          )
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="border-b text-center">
                  {isMine && f.score !== null ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          satTone(f.score),
                        )}
                      />
                      {Math.round(f.score)} %
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-sm">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Légende des couleurs de la grille (préférences de la famille courante). */
export function PlanningLegend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <span className="text-muted-foreground/80">Vos préférences :</span>
      <LegendItem className="bg-pref-bg" label="Préférée" />
      <LegendItem className="bg-alt-bg" label="Alternative" />
      <LegendItem className="bg-imp-bg" label="Impossible" />
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-foreground text-background grid size-4 place-items-center rounded">
          <Check className="size-3" strokeWidth={3.5} />
        </span>
        Attribuée
      </span>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3.5 rounded border", className)} />
      {label}
    </span>
  );
}
