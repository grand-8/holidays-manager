"use client";

import { useActionState, useState } from "react";
import {
  savePreferences,
  optOut,
  cancelOptOut,
  type SavePrefsState,
} from "@/lib/preferences/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Statut = "preferee" | "alternative" | "non_coche" | "impossible";

const STATUT_OPTIONS: { value: Statut; label: string }[] = [
  { value: "preferee", label: "Préférée" },
  { value: "alternative", label: "Alternative" },
  { value: "non_coche", label: "Sans préférence" },
  { value: "impossible", label: "Impossible" },
];

type Week = { id: string; ordre: number; dateDebut: string; dateFin: string };

type Props = {
  annee: number;
  nombreSemaines: number;
  accepteFractionnement: boolean;
  hasAnswered: boolean;
  optedOut: boolean;
  weeks: Week[];
  prefs: Record<string, Statut>;
};

const saveInitial: SavePrefsState = { status: "idle" };

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function PreferencesForm(props: Props) {
  const { annee, nombreSemaines, weeks, optedOut } = props;

  const [statuts, setStatuts] = useState<Record<string, Statut>>(() =>
    Object.fromEntries(
      weeks.map((w) => [w.id, props.prefs[w.id] ?? "non_coche"]),
    ),
  );
  const [saveState, saveAction, savePending] = useActionState(
    savePreferences,
    saveInitial,
  );

  // Vue opt-out : la grille et la case fractionnement n'ont plus d'objet.
  if (optedOut) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Vous ne prenez pas de vacances en {annee}
          </CardTitle>
          <CardDescription>
            Aucune semaine ne vous sera attribuée. Vous pourrez tout de même vous
            manifester pour une semaine restée libre, le cas échéant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={cancelOptOut}>
            <Button type="submit" variant="outline">
              Je veux finalement participer
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Semaines {annee}</CardTitle>
            <CardDescription>
              Indiquez vos préférences. « Sans préférence » compte comme neutre ;
              « Impossible » exclut définitivement la semaine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weeks.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-4 border-b py-2 last:border-0"
              >
                <span className="text-sm">
                  <span className="text-muted-foreground mr-2">
                    S{w.ordre + 1}
                  </span>
                  {fmt(w.dateDebut)} → {fmt(w.dateFin)}
                </span>
                <select
                  name={`statut_${w.id}`}
                  value={statuts[w.id]}
                  onChange={(e) =>
                    setStatuts((s) => ({
                      ...s,
                      [w.id]: e.target.value as Statut,
                    }))
                  }
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  {STATUT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Case fractionnement — obligatoire pour les familles à 2 semaines. */}
        {nombreSemaines === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fractionnement</CardTitle>
              <CardDescription>
                J&apos;accepte que mes 2 semaines soient scindées (non
                consécutives) si nécessaire.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="accepteFractionnement"
                  value="oui"
                  defaultChecked={props.hasAnswered && props.accepteFractionnement}
                  required
                />
                Oui
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="accepteFractionnement"
                  value="non"
                  defaultChecked={props.hasAnswered && !props.accepteFractionnement}
                  required
                />
                Non
              </label>
            </CardContent>
          </Card>
        )}

        {saveState.status !== "idle" && saveState.message && (
          <p
            className={`text-sm ${saveState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {saveState.message}
          </p>
        )}

        <Button type="submit" disabled={savePending}>
          {savePending ? "Enregistrement…" : "Enregistrer mes préférences"}
        </Button>
      </form>

      {/* Opt-out — formulaire distinct (pas de <form> imbriqué). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Je ne prends pas de vacances cette année
          </CardTitle>
          <CardDescription>
            Vous serez retiré du tirage et n&apos;aurez aucune semaine attribuée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={optOut}>
            <Button type="submit" variant="outline">
              Ne pas participer cette année
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
