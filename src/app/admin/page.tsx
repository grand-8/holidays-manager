import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getCompletion } from "@/lib/cycles/service";
import { getConfigHistory } from "@/lib/stats/history";
import { computeWeekSlots } from "@/lib/scheduling/weeks";
import { DEFAULT_SEUIL_SCORE_MINIMUM } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVoteData } from "@/lib/vote/service";
import { CreateCycleForm } from "./create-cycle-form";
import { CycleConfig } from "./cycle-config";
import { GenerateButton } from "./generate-button";
import { AdminDecision } from "./admin-decision";

const STATUT_LABELS: Record<string, string> = {
  config: "Configuration",
  collecte: "Collecte des préférences",
  collecte_tour2: "Second tour",
  generation: "Génération",
  vote: "Vote",
  mediation: "Médiation",
  cloture: "Clôturé",
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  const cycle = await getActiveCycle(admin.propertyId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Administration</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tableau-de-bord">← Tableau de bord</Link>
        </Button>
      </div>

      {!cycle ? (
        <section className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Aucun cycle en cours. Configurez le cycle de l&apos;année pour lancer
            la collecte des préférences.
          </p>
          <CreateCycleForm
            defaultAnnee={new Date().getUTCFullYear()}
            defaultSeuil={DEFAULT_SEUIL_SCORE_MINIMUM}
          />
        </section>
      ) : cycle.statut === "config" ? (
        <ConfigView cycleId={cycle.id} propertyId={admin.propertyId} />
      ) : cycle.statut === "collecte" || cycle.statut === "collecte_tour2" ? (
        <CollecteView
          cycleId={cycle.id}
          propertyId={admin.propertyId}
          annee={cycle.annee}
        />
      ) : cycle.statut === "vote" ? (
        <VoteAdminView cycleId={cycle.id} adminId={admin.id} annee={cycle.annee} />
      ) : (
        <section className="space-y-2">
          <p className="text-sm">
            Cycle <strong>{cycle.annee}</strong> — statut :{" "}
            <strong>{STATUT_LABELS[cycle.statut] ?? cycle.statut}</strong>
          </p>
          <p className="text-muted-foreground text-sm">
            La suite sera pilotée depuis cet écran. (En cours de construction.)
          </p>
        </section>
      )}
    </main>
  );
}

/** Vue admin pendant le vote : décompte + décision, ou récap si déjà décidé. */
async function VoteAdminView({
  cycleId,
  adminId,
  annee,
}: {
  cycleId: string;
  adminId: string;
  annee: number;
}) {
  const data = await getVoteData(cycleId, adminId, true);
  if (!data) return null;

  if (data.finalScheduleProposalId) {
    const idx =
      data.proposals.findIndex((p) => p.id === data.finalScheduleProposalId) + 1;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Décision prise — {annee}</CardTitle>
          <CardDescription>
            Proposition {idx} retenue (
            {data.finalDecidePar === "admin" ? "décision admin" : "issue du vote"}
            ). Le planning est verrouillé.
          </CardDescription>
        </CardHeader>
        {data.finalCommentaire && (
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Justification : </span>
              {data.finalCommentaire}
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <AdminDecision
      cycleId={cycleId}
      proposals={data.proposals.map((p, i) => ({
        id: p.id,
        index: i + 1,
        globalScore: p.globalScore,
        voteCount: p.voteCount ?? 0,
      }))}
    />
  );
}

/** Vue de suivi + déclenchement de la génération (statut collecte). */
async function CollecteView({
  cycleId,
  propertyId,
  annee,
}: {
  cycleId: string;
  propertyId: string;
  annee: number;
}) {
  const rows = await getCompletion(cycleId, propertyId);
  const done = rows.filter((r) => r.responded).length;
  const allResponded = done === rows.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Collecte {annee} — {done}/{rows.length} réponse
            {rows.length > 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            Suivi des familles. Le détail des préférences reste masqué jusqu&apos;à
            la génération.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map((r) => (
              <li
                key={r.userId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{r.nomAffiche}</span>
                <span>
                  {r.responded ? (
                    <span className="text-green-600 dark:text-green-500">
                      Répondu&nbsp;✅{r.optedOut ? " (ne participe pas)" : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      En attente&nbsp;⏳
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Générer les plannings</CardTitle>
          <CardDescription>
            Fige les droits et les préférences, puis calcule les propositions à
            soumettre au vote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GenerateButton cycleId={cycleId} allResponded={allResponded} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Vue de configuration détaillée d'un cycle au statut « config ». */
async function ConfigView({
  cycleId,
  propertyId,
}: {
  cycleId: string;
  propertyId: string;
}) {
  const [cycle, property, history] = await Promise.all([
    prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        weekSlots: { orderBy: { ordre: "asc" } },
        familyRights: { include: { user: true }, orderBy: { user: { nomAffiche: "asc" } } },
      },
    }),
    prisma.property.findUnique({ where: { id: propertyId } }),
    getConfigHistory(propertyId),
  ]);

  if (!cycle || !property) return null;

  const residual =
    cycle.dateDebut && cycle.dateFin
      ? computeWeekSlots(cycle.dateDebut, cycle.dateFin, property.jourBascule)
      : null;

  return (
    <CycleConfig
      cycleId={cycle.id}
      annee={cycle.annee}
      seuil={cycle.seuilScoreMinimum}
      deadlinePreferences={cycle.deadlinePreferences?.toISOString() ?? null}
      deadlineVote={cycle.deadlineVote?.toISOString() ?? null}
      weeks={cycle.weekSlots.map((w) => ({
        ordre: w.ordre,
        dateDebut: w.dateDebut.toISOString(),
        dateFin: w.dateFin.toISOString(),
      }))}
      leadingResidualDays={residual?.leadingResidualDays ?? 0}
      trailingResidualDays={residual?.trailingResidualDays ?? 0}
      families={cycle.familyRights.map((r) => ({
        userId: r.userId,
        nomAffiche: r.user.nomAffiche,
        isAdmin: r.user.isAdmin,
        nombreSemaines: r.nombreSemaines,
        history: history.get(r.userId) ?? null,
      }))}
    />
  );
}
