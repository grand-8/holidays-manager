import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveCycle } from "@/lib/cycles/service";
import { getVoteData } from "@/lib/vote/service";
import { VotePlanning } from "./vote-planning";
import {
  PlanningGrid,
  PlanningLegend,
  type GridFamily,
} from "./planning-grid";

export default async function VotePage() {
  const user = await requireUser();
  const cycle = await getActiveCycle(user.propertyId);
  const data = cycle ? await getVoteData(cycle.id, user.id) : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {!data || data.proposals.length === 0 ? (
        <>
          <h1 className="mb-6 text-xl font-semibold">Vote</h1>
          <p className="text-muted-foreground text-sm">
            Aucune proposition à voter pour le moment.
          </p>
        </>
      ) : data.finalScheduleProposalId ? (
        <ResultView data={data} myUserId={user.id} />
      ) : data.statut === "vote" ? (
        <>
          <div className="mb-5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Vote · Vacances {data.annee}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              Comparer les propositions
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Vous voyez le planning complet et le score global ; votre score et
              vos préférences n&apos;apparaissent que sur votre ligne.
            </p>
          </div>
          <VotePlanning
            proposals={data.proposals}
            weeks={data.weeks}
            myPrefs={data.myPrefs}
            myUserId={user.id}
            myVoteProposalId={data.myVoteProposalId}
            deadline={data.deadlineVote}
          />
        </>
      ) : (
        <>
          <h1 className="mb-6 text-xl font-semibold">Vote</h1>
          <p className="text-muted-foreground text-sm">
            Le vote n&apos;est pas ouvert actuellement.
          </p>
        </>
      )}
    </main>
  );
}

/** Planning retenu, verrouillé (spec section 4.6), affiché en grille. */
function ResultView({
  data,
  myUserId,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getVoteData>>>;
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <CheckCircle2 className="text-good size-3.5" /> Planning confirmé
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Vacances {data.annee}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Décision{" "}
            {data.finalDecidePar === "admin"
              ? "de l'administrateur"
              : "issue du vote"}{" "}
            · satisfaction globale {Math.round(chosen.globalScore)} %. Le planning
            est verrouillé.
          </p>
        </div>
      </div>

      <PlanningLegend />

      <div className="bg-card rounded-xl border p-4 sm:p-5">
        <PlanningGrid
          weeks={data.weeks}
          families={families}
          myUserId={myUserId}
          myPrefs={data.myPrefs}
        />
      </div>

      {data.finalCommentaire && (
        <div className="bg-card rounded-xl border p-4 text-sm">
          <span className="font-medium">Commentaire de l&apos;administrateur : </span>
          {data.finalCommentaire}
        </div>
      )}
    </div>
  );
}
