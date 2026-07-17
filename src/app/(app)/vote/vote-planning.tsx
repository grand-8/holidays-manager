"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Star, Diamond, Loader2 } from "lucide-react";
import { castVote, type CastVoteState } from "@/lib/vote/actions";
import type { ProposalView, ProposalWeek } from "@/lib/vote/service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlanningGrid, PlanningLegend, type GridFamily } from "./planning-grid";

const initial: CastVoteState = { status: "idle" };

export function VotePlanning({
  proposals,
  weeks,
  myPrefs,
  myUserId,
  myVoteProposalId,
  deadline,
}: {
  proposals: ProposalView[];
  weeks: ProposalWeek[];
  myPrefs: Record<number, string>;
  myUserId: string;
  myVoteProposalId: string | null;
  deadline: string | null;
}) {
  const initialIndex = Math.max(
    0,
    proposals.findIndex((p) => p.id === myVoteProposalId),
  );
  const [selected, setSelected] = useState(initialIndex);
  const [state, action, pending] = useActionState(castVote, initial);
  const seen = useRef<CastVoteState>(initial);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.status === "saved") toast.success(state.message ?? "Vote enregistré.");
    else if (state.status === "error")
      toast.error(state.message ?? "Une erreur est survenue.");
  }, [state]);

  const bestGlobal = Math.max(...proposals.map((p) => p.globalScore));
  const bestMin = Math.max(...proposals.map((p) => p.minScore));

  const current = proposals[selected];
  const families: GridFamily[] = current.families.map((f) => ({
    userId: f.userId,
    nomAffiche: f.nomAffiche,
    assigned: f.weeks.map((w) => w.ordre),
    score: f.userId === myUserId ? current.myScore : null,
  }));
  const votedThis = current.id === myVoteProposalId;

  return (
    <div className="space-y-4">
      {deadline && (
        <p className="text-muted-foreground text-sm">
          Modifiable jusqu&apos;au{" "}
          {new Date(deadline).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          .
        </p>
      )}

      {/* Sélecteur de propositions (score dans chaque bouton, 1 à 5). */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {proposals.map((p, i) => {
          const isBest = p.globalScore === bestGlobal;
          const isFairest = !isBest && p.minScore === bestMin;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                "bg-card min-w-[140px] shrink-0 rounded-xl border p-3 text-left transition-colors",
                i === selected
                  ? "border-foreground ring-foreground/10 ring-1"
                  : "hover:border-input",
              )}
            >
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                Proposition {i + 1}
                {isBest && (
                  <Star className="size-3 fill-current" aria-label="Meilleur score" />
                )}
                {isFairest && (
                  <Diamond
                    className="size-3 fill-current"
                    aria-label="La plus équitable"
                  />
                )}
                {p.id === myVoteProposalId && (
                  <Check className="text-good size-3.5" aria-label="Votre vote" />
                )}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {Math.round(p.globalScore)} %
              </div>
              <div className="text-muted-foreground/70 text-[11px]">
                équité {Math.round(p.minScore)} %
              </div>
            </button>
          );
        })}
      </div>

      <PlanningLegend />

      <div className="bg-card rounded-xl border">
        <div className="p-4 sm:p-5">
          <PlanningGrid
            weeks={weeks}
            families={families}
            myUserId={myUserId}
            myPrefs={myPrefs}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4 sm:px-5">
          <div className="flex gap-6">
            <Kpi label="Satisfaction globale" value={`${Math.round(current.globalScore)} %`} />
            <Kpi label="Équité (min.)" value={`${Math.round(current.minScore)} %`} />
            <Kpi
              label="Votre score"
              value={current.myScore === null ? "—" : `${Math.round(current.myScore)} %`}
            />
          </div>
          <form action={action}>
            <input type="hidden" name="proposalId" value={current.id} />
            <Button type="submit" disabled={pending || votedThis}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {votedThis
                ? "✓ Votre vote actuel"
                : myVoteProposalId
                  ? "Voter pour celle-ci"
                  : "Voter pour cette proposition"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground/70 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
