"use client";

import { useActionState, useState } from "react";
import {
  saveFamilyRights,
  launchCollection,
  type SaveRightsState,
  type LaunchState,
} from "@/lib/cycles/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FamilyRow = {
  userId: string;
  nomAffiche: string;
  isAdmin: boolean;
  nombreSemaines: number;
  history: { timesWith2Weeks: number; lastYearWith2Weeks: number | null } | null;
};

type Props = {
  cycleId: string;
  annee: number;
  seuil: number;
  deadlinePreferences: string | null;
  deadlineVote: string | null;
  weeks: { ordre: number; dateDebut: string; dateFin: string }[];
  leadingResidualDays: number;
  trailingResidualDays: number;
  families: FamilyRow[];
};

const saveInitial: SaveRightsState = { status: "idle" };
const launchInitial: LaunchState = { status: "idle" };

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function CycleConfig(props: Props) {
  const { cycleId, annee, seuil, weeks, families } = props;
  const weekCount = weeks.length;

  // État local des droits pour un indicateur de cohérence en temps réel.
  const [rights, setRights] = useState<Record<string, number>>(
    Object.fromEntries(families.map((f) => [f.userId, f.nombreSemaines])),
  );
  const totalRights = Object.values(rights).reduce((s, n) => s + n, 0);
  const coherent = totalRights <= weekCount;

  const [saveState, saveAction, savePending] = useActionState(
    saveFamilyRights,
    saveInitial,
  );
  const [launchState, launchAction, launchPending] = useActionState(
    launchCollection,
    launchInitial,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Cycle {annee}</h2>
        <p className="text-muted-foreground text-sm">
          Statut : configuration. Seuil de score minimum : {seuil} %.
        </p>
      </div>

      {/* Semaines de la période */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Période — {weekCount} semaine{weekCount > 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>Découpage samedi → samedi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {weeks.map((w) => (
              <li key={w.ordre} className="flex gap-2">
                <span className="text-muted-foreground w-6">
                  S{w.ordre + 1}
                </span>
                <span>
                  {fmt(w.dateDebut)} → {fmt(w.dateFin)}
                </span>
              </li>
            ))}
          </ul>
          {(props.leadingResidualDays > 0 || props.trailingResidualDays > 0) && (
            <p className="text-muted-foreground text-xs">
              Non utilisable :{" "}
              {props.leadingResidualDays > 0 &&
                `${props.leadingResidualDays} j en début`}
              {props.leadingResidualDays > 0 &&
              props.trailingResidualDays > 0
                ? ", "
                : ""}
              {props.trailingResidualDays > 0 &&
                `${props.trailingResidualDays} j en fin`}
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Droits annuels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Droits annuels</CardTitle>
          <CardDescription>
            1 ou 2 semaines par famille. L&apos;historique est indicatif.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="cycleId" value={cycleId} />
            {families.map((f) => (
              <div
                key={f.userId}
                className="flex items-center justify-between gap-4 border-b py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {f.nomAffiche}
                    {f.isAdmin && (
                      <span className="text-muted-foreground"> (admin)</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {f.history
                      ? `2 sem. : ${f.history.timesWith2Weeks}× · dernière ${f.history.lastYearWith2Weeks}`
                      : "aucune donnée disponible"}
                  </p>
                </div>
                <select
                  name={`right_${f.userId}`}
                  value={String(rights[f.userId] ?? f.nombreSemaines)}
                  onChange={(e) =>
                    setRights((r) => ({
                      ...r,
                      [f.userId]: Number(e.target.value),
                    }))
                  }
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  <option value="1">1 semaine</option>
                  <option value="2">2 semaines</option>
                </select>
              </div>
            ))}

            <div
              className={`text-sm ${coherent ? "text-muted-foreground" : "text-destructive"}`}
            >
              {totalRights} semaine{totalRights > 1 ? "s" : ""} de droits pour{" "}
              {weekCount} disponible{weekCount > 1 ? "s" : ""}.
              {!coherent && " Réduisez les droits avant de lancer la collecte."}
            </div>

            {saveState.status !== "idle" && saveState.message && (
              <p
                className={`text-sm ${saveState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {saveState.message}
              </p>
            )}

            <Button type="submit" variant="outline" disabled={savePending}>
              {savePending ? "Enregistrement…" : "Enregistrer les droits"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lancement de la collecte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lancer la collecte</CardTitle>
          <CardDescription>
            Envoie l&apos;invitation à toutes les familles et verrouille
            définitivement la période et le découpage en semaines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {launchState.status === "error" && (
            <p className="text-destructive text-sm">{launchState.message}</p>
          )}
          <form action={launchAction}>
            <input type="hidden" name="cycleId" value={cycleId} />
            <Button type="submit" disabled={launchPending || !coherent}>
              {launchPending ? "Envoi…" : "Lancer la collecte"}
            </Button>
          </form>
          {!coherent && (
            <p className="text-muted-foreground text-xs">
              Enregistrez d&apos;abord des droits cohérents.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
