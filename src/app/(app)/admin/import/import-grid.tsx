"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import {
  addImportYear,
  saveHistory,
  deleteHistoryYear,
  type HistoryState,
} from "@/lib/history/actions";
import type { HistoryGrid } from "@/lib/history/service";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: HistoryState = { status: "idle" };

export function ImportGrid({ grid }: { grid: HistoryGrid }) {
  const [addState, addAction, addPending] = useActionState(
    addImportYear,
    initial,
  );
  const [saveState, saveAction, savePending] = useActionState(
    saveHistory,
    initial,
  );

  const nextYear = grid.years.length
    ? Math.min(...grid.years.map((y) => y.annee)) - 1
    : new Date().getUTCFullYear() - 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une année passée</CardTitle>
          <CardDescription>
            Crée une année d&apos;historique (importée) à renseigner ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addAction} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="annee">Année</Label>
              <Input
                id="annee"
                name="annee"
                type="number"
                defaultValue={nextYear}
                className="w-32"
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={addPending}>
              {addPending ? "Ajout…" : "Ajouter l'année"}
            </Button>
          </form>
          {addState.status !== "idle" && addState.message && (
            <p
              className={`mt-3 text-sm ${addState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {addState.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Semaines par famille et par année
          </CardTitle>
          <CardDescription>
            1 ou 2 semaines, ou vide si non applicable. Toute modification est
            journalisée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {grid.years.length === 0 || grid.families.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {grid.families.length === 0
                ? "Aucune famille active."
                : "Aucune année d'historique pour le moment. Ajoutez-en une ci-dessus."}
            </p>
          ) : (
            <form
              action={saveAction}
              className="space-y-4"
              // Remonte la grille quand les valeurs persistées changent (après
              // enregistrement) pour que les sélecteurs reflètent la base.
              key={grid.years
                .map((y) => `${y.cycleId}:${Object.entries(y.rights).sort().join(",")}`)
                .join("|")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left">
                      <th className="py-2 pr-2 font-medium">Année</th>
                      {grid.families.map((f) => (
                        <th
                          key={f.userId}
                          className="px-2 py-2 text-center font-medium"
                        >
                          {f.nomAffiche}
                        </th>
                      ))}
                      <th className="py-2 pl-2">
                        <span className="sr-only">Supprimer l&apos;année</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.years.map((y) => (
                      <tr key={y.cycleId} className="border-b last:border-0">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {y.annee}
                          {y.origine === "importe" && (
                            <span className="text-muted-foreground text-xs">
                              {" "}
                              (import)
                            </span>
                          )}
                        </td>
                        {grid.families.map((f) => (
                          <td key={f.userId} className="px-2 py-2 text-center">
                            <select
                              name={`cell_${y.cycleId}_${f.userId}`}
                              defaultValue={String(y.rights[f.userId] ?? "")}
                              className="border-input bg-background h-8 rounded-md border px-1 text-sm"
                            >
                              <option value="">—</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                            </select>
                          </td>
                        ))}
                        <td className="py-2 pl-2 text-right">
                          <ConfirmButton
                            formAction={deleteHistoryYear.bind(null, y.cycleId)}
                            variant="ghost"
                            size="sm"
                            aria-label={`Supprimer l'année ${y.annee}`}
                            className="text-muted-foreground hover:text-destructive"
                            message={`Supprimer définitivement l'année ${y.annee} de l'historique ? Cette action est irréversible.`}
                          >
                            <Trash2 className="size-4" />
                          </ConfirmButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {saveState.status !== "idle" && saveState.message && (
                <p
                  className={`text-sm ${saveState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {saveState.message}
                </p>
              )}
              <Button type="submit" disabled={savePending}>
                {savePending ? "Enregistrement…" : "Enregistrer l'historique"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
