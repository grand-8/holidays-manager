"use client";

import { useActionState, useState } from "react";
import { saveMediation, type MediationState } from "@/lib/fallback/actions";
import type { MediationData } from "@/lib/fallback/service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const PREF_LABEL: Record<string, string> = {
  preferee: "préférée",
  alternative: "alternative",
  impossible: "impossible",
};

const initial: MediationState = { status: "idle" };

/**
 * Médiation manuelle (spec section 4.7.2) : l'admin attribue les semaines en
 * voyant toutes les préférences en clair, avec un commentaire obligatoire.
 */
export function MediationGrid({ data }: { data: MediationData }) {
  const [state, action, pending] = useActionState(saveMediation, initial);
  // Suivi local des sélections pour afficher le décompte par famille.
  const [selection, setSelection] = useState<Record<string, Set<string>>>({});

  function toggle(userId: string, weekSlotId: string, checked: boolean) {
    setSelection((prev) => {
      const set = new Set(prev[userId] ?? []);
      if (checked) set.add(weekSlotId);
      else set.delete(weekSlotId);
      return { ...prev, [userId]: set };
    });
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="cycleId" value={data.cycleId} />

      {data.families.map((fam) => {
        const count = selection[fam.userId]?.size ?? 0;
        const ok = count === fam.nombreSemaines;
        return (
          <div key={fam.userId} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">{fam.nomAffiche}</p>
              <span
                className={`text-sm ${ok ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}`}
              >
                {count}/{fam.nombreSemaines} semaine
                {fam.nombreSemaines > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.weeks.map((w) => {
                const statut = fam.prefs[w.id];
                const impossible = statut === "impossible";
                return (
                  <label
                    key={w.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      impossible ? "opacity-50" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={`week_${fam.userId}`}
                      value={w.id}
                      disabled={impossible}
                      onChange={(e) =>
                        toggle(fam.userId, w.id, e.currentTarget.checked)
                      }
                    />
                    <span>
                      {fmt(w.dateDebut)}→{fmt(w.dateFin)}
                    </span>
                    {statut && PREF_LABEL[statut] && (
                      <span className="text-muted-foreground ml-auto text-xs">
                        {PREF_LABEL[statut]}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        <Label htmlFor="commentaire">
          Commentaire justificatif (obligatoire, visible par les familles)
        </Label>
        <textarea
          id="commentaire"
          name="commentaire"
          required
          rows={3}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Expliquez l'arbitrage retenu…"
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Valider le planning de médiation"}
      </Button>
    </form>
  );
}
