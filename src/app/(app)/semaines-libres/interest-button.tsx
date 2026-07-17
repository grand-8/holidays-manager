"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  const seen = useRef<InterestState>(initial);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.status === "saved")
      toast.success(interested ? "Intérêt retiré." : "Intérêt enregistré.");
    else if (state.status === "error")
      toast.error(state.message ?? "Une erreur est survenue.");
  }, [state, interested]);

  return (
    <form action={action}>
      <input type="hidden" name="weekSlotId" value={weekSlotId} />
      <Button
        type="submit"
        size="sm"
        variant={interested ? "outline" : "default"}
        disabled={pending}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {interested ? "Retirer mon intérêt" : "Je suis intéressé"}
      </Button>
    </form>
  );
}
