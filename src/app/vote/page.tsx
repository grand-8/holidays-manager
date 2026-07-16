import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getActiveCycle } from "@/lib/cycles/service";
import { getVoteData } from "@/lib/vote/service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VoteForm } from "./vote-form";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function VotePage() {
  const user = await requireUser();
  const cycle = await getActiveCycle(user.propertyId);
  const data = cycle ? await getVoteData(cycle.id, user.id) : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vote</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tableau-de-bord">← Tableau de bord</Link>
        </Button>
      </div>

      {!data || data.proposals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune proposition à voter pour le moment.
        </p>
      ) : data.finalScheduleProposalId ? (
        <ResultView data={data} />
      ) : data.statut === "vote" ? (
        <VoteForm
          proposals={data.proposals}
          myVoteProposalId={data.myVoteProposalId}
          deadline={data.deadlineVote}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Le vote n&apos;est pas ouvert actuellement.
        </p>
      )}
    </main>
  );
}

/** Affichage du planning retenu, verrouillé (spec section 4.6). */
function ResultView({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getVoteData>>>;
}) {
  const chosen = data.proposals.find(
    (p) => p.id === data.finalScheduleProposalId,
  );
  if (!chosen) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning {data.annee} retenu</CardTitle>
          <CardDescription>
            Décision {data.finalDecidePar === "admin" ? "de l'administrateur" : "issue du vote"}.
            Score global {Math.round(chosen.globalScore)} %.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {chosen.families.map((f) => (
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
          {data.finalCommentaire && (
            <p className="border-t pt-3 text-sm">
              <span className="font-medium">Commentaire de l&apos;admin : </span>
              {data.finalCommentaire}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
