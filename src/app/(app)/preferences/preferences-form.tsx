"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Loader2 } from "lucide-react";
import {
  savePreferences,
  optOut,
  cancelOptOut,
  type SavePrefsState,
} from "@/lib/preferences/actions";
import { canTakeTwoWeeks } from "@/lib/scheduling/generate";
import type { FamilyInput, PreferenceStatus } from "@/lib/scheduling/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SavedNotice } from "@/components/saved-notice";
import { cn } from "@/lib/utils";

type Statut = "preferee" | "alternative" | "non_coche" | "impossible";

const STATUT_OPTIONS: {
  value: Statut;
  label: string;
  dot: string;
  active: string;
}[] = [
  { value: "preferee", label: "Préférée", dot: "bg-pref", active: "text-pref" },
  { value: "alternative", label: "Alternative", dot: "bg-alt", active: "text-alt" },
  {
    value: "non_coche",
    label: "Sans préférence",
    dot: "bg-neutral-dot",
    active: "text-foreground",
  },
  { value: "impossible", label: "Impossible", dot: "bg-imp", active: "text-imp" },
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

/** Contrôle segmenté (pastilles) pour un choix parmi des options colorées. */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; dot?: string; active?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-background inline-flex flex-wrap gap-0.5 rounded-lg border p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              on
                ? cn("bg-card font-semibold shadow-sm", o.active)
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.dot && <span className={cn("size-2 rounded-full", o.dot)} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreferencesForm(props: Props) {
  const { annee, nombreSemaines, weeks, optedOut } = props;

  const [statuts, setStatuts] = useState<Record<string, Statut>>(() =>
    Object.fromEntries(
      weeks.map((w) => [w.id, props.prefs[w.id] ?? "non_coche"]),
    ),
  );
  const [fractionnement, setFractionnement] = useState<string>(
    props.hasAnswered ? (props.accepteFractionnement ? "oui" : "non") : "",
  );
  // Suivi « modifications non enregistrées » pour un retour visuel clair.
  const [dirty, setDirty] = useState(false);
  const [savedOnce, setSavedOnce] = useState(props.hasAnswered);
  const [saveState, saveAction, savePending] = useActionState(
    savePreferences,
    saveInitial,
  );
  const seen = useRef<SavePrefsState>(saveInitial);

  // Une famille à 2 semaines peut-elle réellement en obtenir 2 avec ses choix
  // actuels ? (mêmes règles que l'algorithme : §4.2/§4.5). Sinon, on lui demande
  // de confirmer qu'elle accepte de n'avoir qu'une seule semaine.
  const canGetTwoWeeks = (): boolean => {
    if (nombreSemaines !== 2) return true;
    const prefs: Record<number, PreferenceStatus> = {};
    for (const w of weeks) {
      const s = statuts[w.id];
      if (s && s !== "non_coche") prefs[w.ordre] = s;
    }
    const fam: FamilyInput = {
      id: "self",
      rightWeeks: 2,
      acceptsSplit: fractionnement === "oui",
      prefs,
    };
    return canTakeTwoWeeks(fam, weeks.length);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (nombreSemaines === 2 && !canGetTwoWeeks()) {
      const ok = window.confirm(
        "Vous avez droit à 2 semaines, mais vos choix actuels ne permettent d'en " +
          "attribuer qu'une seule (pas assez de semaines possibles, ou deux " +
          "semaines non consécutives sans accepter de les scinder).\n\n" +
          "Confirmez-vous ne vouloir qu'une seule semaine cette année ?",
      );
      if (!ok) e.preventDefault();
    }
  };

  useEffect(() => {
    if (saveState === seen.current) return;
    seen.current = saveState;
    if (saveState.status === "saved") {
      toast.success(saveState.message ?? "Préférences enregistrées.");
      // Réaction au résultat de la Server Action (source externe au rendu).
      /* eslint-disable react-hooks/set-state-in-effect */
      setDirty(false);
      setSavedOnce(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } else if (saveState.status === "error")
      toast.error(saveState.message ?? "Une erreur est survenue.");
  }, [saveState]);

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
      <div className="border-good/30 bg-good/10 flex items-center gap-2.5 rounded-lg border p-3.5 text-sm">
        <CalendarCheck className="text-good size-4 shrink-0" />
        <span>
          Votre droit cette année :{" "}
          <strong>
            {nombreSemaines === 2 ? "2 semaines" : "1 semaine"}
          </strong>
          {nombreSemaines === 2 && (
            <span className="text-muted-foreground">
              {" "}
              — vos choix doivent permettre d&apos;en attribuer deux, sinon une
              seule vous sera proposée.
            </span>
          )}
        </span>
      </div>

      <form action={saveAction} onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Semaines {annee}</CardTitle>
            <CardDescription>
              Indiquez vos préférences. « Sans préférence » compte comme neutre ;
              « Impossible » exclut définitivement la semaine.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {weeks.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm">
                  <span className="text-muted-foreground/70 mr-2 font-mono text-xs">
                    S{w.ordre + 1}
                  </span>
                  {fmt(w.dateDebut)} → {fmt(w.dateFin)}
                </span>
                <input
                  type="hidden"
                  name={`statut_${w.id}`}
                  value={statuts[w.id]}
                />
                <Segmented
                  options={STATUT_OPTIONS}
                  value={statuts[w.id]}
                  onChange={(v) => {
                    setStatuts((s) => ({ ...s, [w.id]: v as Statut }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {nombreSemaines === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fractionnement</CardTitle>
              <CardDescription>
                J&apos;accepte que mes 2 semaines soient scindées (non
                consécutives) si nécessaire. Réponse obligatoire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="hidden"
                name="accepteFractionnement"
                value={fractionnement}
              />
              <Segmented
                options={[
                  { value: "oui", label: "Oui" },
                  { value: "non", label: "Non" },
                ]}
                value={fractionnement}
                onChange={(v) => {
                  setFractionnement(v);
                  setDirty(true);
                }}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={savePending || (savedOnce && !dirty)}>
            {savePending && <Loader2 className="size-4 animate-spin" />}
            {savePending
              ? "Enregistrement…"
              : savedOnce && !dirty
                ? "Enregistré ✓"
                : savedOnce
                  ? "Enregistrer les modifications"
                  : "Enregistrer mes préférences"}
          </Button>
          {dirty && savedOnce && (
            <span className="text-muted-foreground text-sm">
              Modifications non enregistrées.
            </span>
          )}
        </div>

        {savedOnce && !dirty && !savePending && (
          <SavedNotice>
            Vos préférences sont enregistrées. Vous pouvez les modifier jusqu&apos;à
            la clôture.
          </SavedNotice>
        )}
      </form>

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
