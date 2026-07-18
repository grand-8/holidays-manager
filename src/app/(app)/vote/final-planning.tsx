import type { VoteData } from "@/lib/vote/service";
import { PlanningGrid, PlanningLegend, type GridFamily } from "./planning-grid";

/**
 * Planning retenu et verrouillé (spec section 4.6), affiché en grille. Réutilisé
 * par la page de vote, le tableau de bord et l'écran d'administration pour que le
 * planning validé reste consultable, y compris après clôture du cycle.
 */
export function FinalPlanning({
  data,
  myUserId,
}: {
  data: VoteData;
  myUserId: string;
}) {
  const chosen = data.proposals.find(
    (p) => p.id === data.finalScheduleProposalId,
  );
  if (!chosen) return null;

  const families: GridFamily[] = chosen.families.map((f) => ({
    userId: f.userId,
    nomAffiche: f.nomAffiche,
    assigned: f.weeks.map((w) => w.ordre),
    score: f.userId === myUserId ? chosen.myScore : null,
  }));

  return (
    <div className="space-y-4">
      <PlanningLegend />
      <div className="bg-card rounded-xl border p-4 sm:p-5">
        <PlanningGrid
          weeks={data.weeks}
          families={families}
          myUserId={myUserId}
          prefsByUser={data.prefsByUser}
        />
      </div>
      {data.finalCommentaire && (
        <div className="bg-card rounded-xl border p-4 text-sm">
          <span className="font-medium">
            Commentaire de l&apos;administrateur :{" "}
          </span>
          {data.finalCommentaire}
        </div>
      )}
    </div>
  );
}
