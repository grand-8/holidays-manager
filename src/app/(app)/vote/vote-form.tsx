"use client";

import { useActionState, useState } from "react";
import { castVote, type CastVoteState } from "@/lib/vote/actions";
import type { ProposalView } from "@/lib/vote/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const initial: CastVoteState = { status: "idle" };

export function VoteForm({
  proposals,
  myVoteProposalId,
  deadline,
}: {
  proposals: ProposalView[];
  myVoteProposalId: string | null;
  deadline: string | null;
}) {
  const [choice, setChoice] = useState<string | null>(myVoteProposalId);
  const [state, action, pending] = useActionState(castVote, initial);

  return (
    <form action={action} className="space-y-4">
      {deadline && (
        <p className="text-muted-foreground text-sm">
          Vous pouvez modifier votre vote jusqu&apos;au{" "}
          {new Date(deadline).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          .
        </p>
      )}

      <div className="space-y-3">
        {proposals.map((p, i) => (
          <label key={p.id} className="block cursor-pointer">
            <Card
              className={
                choice === p.id ? "border-foreground ring-foreground/20 ring-2" : ""
              }
            >
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="proposalId"
                      value={p.id}
                      checked={choice === p.id}
                      onChange={() => setChoice(p.id)}
                    />
                    <span className="font-medium">Proposition {i + 1}</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">
                      Score global {Math.round(p.globalScore)} %
                    </div>
                    <div>
                      Votre score{" "}
                      <strong>
                        {p.myScore === null ? "—" : `${Math.round(p.myScore)} %`}
                      </strong>
                    </div>
                  </div>
                </div>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {p.families.map((f) => (
                    <li key={f.userId} className="flex gap-2">
                      <span className="font-medium">{f.nomAffiche} :</span>
                      <span className="text-muted-foreground">
                        {f.weeks
                          .map((w) => `${fmt(w.dateDebut)}→${fmt(w.dateFin)}`)
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </label>
        ))}
      </div>

      {state.status !== "idle" && state.message && (
        <p
          className={`text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending || choice === null}>
        {pending ? "Envoi…" : myVoteProposalId ? "Modifier mon vote" : "Voter"}
      </Button>
    </form>
  );
}
