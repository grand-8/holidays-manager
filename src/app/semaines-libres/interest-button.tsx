"use client";

import { useActionState } from "react";
import { toggleInterest, type InterestState } from "@/lib/unclaimed/actions";
import { Button } from "@/components/ui/button";

const initial: InterestState = { status: "idle" };

/** Bouton famille : (dé)clarer son intérêt pour une semaine disponible. */
export function InterestButton({
  weekSlotId,
  interested,
}: {
  weekSlotId: string;
  interested: boolean;
}) {
  const [state, action, pending] = useActionState(toggleInterest, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="weekSlotId" value={weekSlotId} />
      <Button
        type="submit"
        size="sm"
        variant={interested ? "outline" : "default"}
        disabled={pending}
      >
        {pending
          ? "…"
          : interested
            ? "Retirer mon intérêt"
            : "Je suis intéressé"}
      </Button>
      {state.status === "error" && state.message && (
        <span className="text-destructive text-xs">{state.message}</span>
      )}
    </form>
  );
}
