"use client";

import { useActionState } from "react";
import {
  createCycle,
  type CreateCycleState,
} from "@/lib/cycles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: CreateCycleState = { status: "idle" };

export function CreateCycleForm({
  defaultAnnee,
  defaultSeuil,
}: {
  defaultAnnee: number;
  defaultSeuil: number;
}) {
  const [state, action, pending] = useActionState(createCycle, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau cycle</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annee">Année</Label>
              <Input
                id="annee"
                name="annee"
                type="number"
                defaultValue={defaultAnnee}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seuil">Seuil de score min. (%)</Label>
              <Input
                id="seuil"
                name="seuil"
                type="number"
                min={0}
                max={100}
                defaultValue={defaultSeuil}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Début de la période</Label>
              <Input id="dateDebut" name="dateDebut" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFin">Fin de la période</Label>
              <Input id="dateFin" name="dateFin" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadlinePreferences">Deadline préférences</Label>
              <Input
                id="deadlinePreferences"
                name="deadlinePreferences"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadlineVote">Deadline vote</Label>
              <Input id="deadlineVote" name="deadlineVote" type="date" required />
            </div>
          </div>

          {state.status === "error" && (
            <p className="text-destructive text-sm">{state.message}</p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Création…" : "Créer le cycle"}
          </Button>
          <p className="text-muted-foreground text-xs">
            La période sera découpée automatiquement en semaines samedi → samedi.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
