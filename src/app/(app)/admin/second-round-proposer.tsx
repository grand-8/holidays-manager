"use client";

import { useState } from "react";
import { proposeSecondRound } from "@/lib/fallback/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import type { SecondRoundCandidate } from "@/lib/fallback/service";

/**
 * Écran de ciblage d'un second tour proposé par l'admin (§4.7.1 manuel).
 * Les familles « en tension » sont pré-cochées ; l'admin ajuste puis confirme.
 * La confirmation purge les propositions/votes en cours (nouvelle génération ensuite).
 */
export function SecondRoundProposer({
  cycleId,
  candidates,
}: {
  cycleId: string;
  candidates: SecondRoundCandidate[];
}) {
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Proposer un second tour
      </Button>
    );
  }

  return (
    <form action={proposeSecondRound} className="space-y-3">
      <input type="hidden" name="cycleId" value={cycleId} />
      <p className="text-muted-foreground text-sm">
        Cochez les familles autorisées à ré-ajuster leurs préférences. Les
        familles « en tension » (en concurrence sur une semaine très demandée)
        sont pré-cochées. Les propositions et votes en cours seront remis à zéro ;
        une nouvelle génération sera nécessaire ensuite.
      </p>
      <ul className="divide-y rounded-lg border">
        {candidates.map((c) => (
          <li
            key={c.userId}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="userIds"
              value={c.userId}
              defaultChecked={c.suggested}
              id={`sr_${c.userId}`}
              className="accent-foreground size-4"
            />
            <label htmlFor={`sr_${c.userId}`} className="flex-1">
              {c.nomAffiche}
              {c.suggested && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-500">
                  en tension
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          size="sm"
          message="Proposer un second tour aux familles cochées ? Les propositions et votes actuels seront supprimés."
        >
          Confirmer le second tour
        </ConfirmButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
