"use client";

import { useActionState } from "react";
import {
  generatePlannings,
  type GenerateState,
} from "@/lib/cycles/actions";
import { Button } from "@/components/ui/button";

const initial: GenerateState = { status: "idle" };

export function GenerateButton({
  cycleId,
  allResponded,
}: {
  cycleId: string;
  allResponded: boolean;
}) {
  const [state, action, pending] = useActionState(generatePlannings, initial);

  return (
    <div className="space-y-3">
      {!allResponded && (
        <p className="text-muted-foreground text-sm">
          Certaines familles n&apos;ont pas encore répondu. Vous pouvez tout de
          même générer : leurs semaines non renseignées comptent comme « sans
          préférence ».
        </p>
      )}
      {state.status === "error" && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}
      {state.status === "fallback" && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}
      <form action={action}>
        <input type="hidden" name="cycleId" value={cycleId} />
        <Button type="submit" disabled={pending}>
          {pending ? "Génération…" : "Générer les plannings"}
        </Button>
      </form>
    </div>
  );
}
