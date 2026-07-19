import { CheckCircle2, Vote as VoteIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveCycle } from "@/lib/cycles/service";
import { getDecidedCycle } from "@/lib/unclaimed/service";
import { getVoteData } from "@/lib/vote/service";
import { getJourneyStage, voteEmptyMessage } from "@/lib/journey";
import { EmptyState } from "@/components/empty-state";
import { VotePlanning } from "./vote-planning";
import { FinalPlanning } from "./final-planning";

export default async function VotePage() {
  const user = await requireUser();
  // Cycle actif s'il y en a un ; sinon on retombe sur le dernier cycle décidé
  // pour que le planning validé reste consultable après la clôture.
  const active = await getActiveCycle(user.propertyId);
  const cycleId =
    active?.id ?? (await getDecidedCycle(user.propertyId))?.id ?? null;
  const data = cycleId
    ? await getVoteData(cycleId, user.id, user.propertyId)
    : null;

  const canVote =
    data && data.statut === "vote" && data.proposals.length > 0;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {data?.finalScheduleProposalId ? (
        <ResultView data={data} myUserId={user.id} />
      ) : canVote ? (
        <>
          <div className="mb-5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Vote · Vacances {data.annee}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {data.proposals.length === 1
                ? "La répartition proposée"
                : "Comparer les propositions"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {data.proposals.length === 1
                ? "Une seule répartition est possible avec les préférences de chacun. Confirmez-la par votre vote."
                : "Vous voyez le planning complet, les préférences et le taux de satisfaction de chaque famille pour voter en toute transparence."}
            </p>
          </div>
          <VotePlanning
            proposals={data.proposals}
            weeks={data.weeks}
            prefsByUser={data.prefsByUser}
            myUserId={user.id}
            myVoteProposalId={data.myVoteProposalId}
            deadline={data.deadlineVote}
          />
        </>
      ) : (
        <>
          <h1 className="mb-6 text-xl font-semibold">Vote</h1>
          <VoteEmpty userId={user.id} propertyId={user.propertyId} />
        </>
      )}
    </main>
  );
}

/** État vide contextuel du vote (selon l'étape du cycle). */
async function VoteEmpty({
  userId,
  propertyId,
}: {
  userId: string;
  propertyId: string;
}) {
  const msg = voteEmptyMessage(await getJourneyStage(userId, propertyId));
  return (
    <EmptyState
      icon={<VoteIcon className="size-5" />}
      title={msg.title}
      description={msg.description}
      cta={msg.cta}
    />
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

      <FinalPlanning data={data} myUserId={myUserId} />
    </div>
  );
}
