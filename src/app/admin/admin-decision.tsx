"use client";

import { useActionState, useState } from "react";
import {
  decideByVote,
  forceDecision,
  type ForceDecisionState,
} from "@/lib/vote/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProposalTally = {
  id: string;
  index: number;
  globalScore: number;
  voteCount: number;
};

const forceInitial: ForceDecisionState = { status: "idle" };

export function AdminDecision({
  cycleId,
  proposals,
}: {
  cycleId: string;
  proposals: ProposalTally[];
}) {
  const [forcing, setForcing] = useState(false);
  const [forceState, forceAction, forcePending] = useActionState(
    forceDecision,
    forceInitial,
  );
  const totalVotes = proposals.reduce((s, p) => s + p.voteCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Décision</CardTitle>
        <CardDescription>
          {totalVotes} vote{totalVotes > 1 ? "s" : ""} reçu
          {totalVotes > 1 ? "s" : ""}. La proposition avec le plus de votes
          l&apos;emporte (départage par score global).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y text-sm">
          {proposals.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                Proposition {p.index} — score global {Math.round(p.globalScore)} %
              </span>
              <span className="font-medium">
                {p.voteCount} vote{p.voteCount > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>

        <form action={decideByVote}>
          <input type="hidden" name="cycleId" value={cycleId} />
          <Button type="submit">Valider le résultat du vote</Button>
        </form>

        {!forcing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setForcing(true)}
          >
            Forcer une autre décision…
          </Button>
        ) : (
          <form action={forceAction} className="space-y-3 border-t pt-4">
            <input type="hidden" name="cycleId" value={cycleId} />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="proposalId">
                Proposition à imposer
              </label>
              <select
                id="proposalId"
                name="proposalId"
                required
                defaultValue=""
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    Proposition {p.index} (score {Math.round(p.globalScore)} %)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="commentaire">
                Justification (visible par toutes les familles)
              </label>
              <textarea
                id="commentaire"
                name="commentaire"
                required
                rows={3}
                className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                placeholder="Motif de la décision…"
              />
            </div>
            {forceState.status === "error" && (
              <p className="text-destructive text-sm">{forceState.message}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={forcePending}>
                {forcePending ? "Enregistrement…" : "Imposer cette décision"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForcing(false)}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
