import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getCompletion } from "@/lib/cycles/service";
import { closeCycle, deleteCycle } from "@/lib/cycles/actions";
import { ConfirmButton } from "@/components/confirm-button";
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
import { getMediationData, getSecondRoundSuggestions } from "@/lib/fallback/service";
import { goToMediation, forceRestart } from "@/lib/fallback/actions";
import { SecondRoundProposer } from "./second-round-proposer";
import { CheckCircle2 } from "lucide-react";
import { AdminTabs } from "@/components/admin-tabs";
import { PropertyNameForm } from "@/components/property-name-form";
import { CreateCycleForm } from "./create-cycle-form";
import { CycleConfig } from "./cycle-config";
import { GenerateButton } from "./generate-button";
import { AdminDecision } from "./admin-decision";
import { MediationGrid } from "./mediation-grid";
import { FinalPlanning } from "../vote/final-planning";

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
  const [cycle, property] = await Promise.all([
    getActiveCycle(admin.propertyId),
    prisma.property.findUnique({
      where: { id: admin.propertyId },
      select: { nom: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-xl font-semibold">Administration</h1>
      <AdminTabs />

      {property && (
        <div className="mb-6">
          <PropertyNameForm nom={property.nom} />
        </div>
      )}

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
          statut={cycle.statut}
        />
      ) : cycle.statut === "vote" ? (
        <VoteAdminView
          cycleId={cycle.id}
          adminId={admin.id}
          annee={cycle.annee}
          propertyId={admin.propertyId}
        />
      ) : cycle.statut === "mediation" ? (
        <MediationView
          cycleId={cycle.id}
          adminId={admin.id}
          annee={cycle.annee}
          propertyId={admin.propertyId}
        />
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

      {cycle && cycle.statut !== "cloture" && (
        <DangerZone cycleId={cycle.id} annee={cycle.annee} />
      )}
    </main>
  );
}

/** Zone de danger : suppression complète du cycle en cours (§ admin). */
function DangerZone({ cycleId, annee }: { cycleId: string; annee: number }) {
  return (
    <Card className="border-destructive/30 mt-8">
      <CardHeader>
        <CardTitle className="text-destructive text-base">
          Supprimer le cycle {annee}
        </CardTitle>
        <CardDescription>
          Supprime définitivement ce cycle et toutes ses données (préférences,
          propositions, votes, décision). À utiliser en cas de problème pour
          repartir de zéro : vous pourrez ensuite recréer le cycle de
          l&apos;année. Sans effet sur l&apos;historique des années clôturées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={deleteCycle}>
          <input type="hidden" name="cycleId" value={cycleId} />
          <ConfirmButton
            variant="destructive"
            size="sm"
            message={`Supprimer définitivement le cycle ${annee} et toutes ses données ? Cette action est irréversible.`}
          >
            Supprimer le cycle
          </ConfirmButton>
        </form>
      </CardContent>
    </Card>
  );
}

/** Vue admin pendant le vote : décompte + décision, ou récap si déjà décidé. */
async function VoteAdminView({
  cycleId,
  adminId,
  annee,
  propertyId,
}: {
  cycleId: string;
  adminId: string;
  annee: number;
  propertyId: string;
}) {
  const [data, familyCount, suggestions] = await Promise.all([
    getVoteData(cycleId, adminId, propertyId, true),
    prisma.user.count({ where: { propertyId, actif: true } }),
    getSecondRoundSuggestions(cycleId, propertyId),
  ]);
  if (!data) return null;

  if (data.finalScheduleProposalId) {
    return (
      <DecidedCard cycleId={cycleId} annee={annee} data={data} adminId={adminId} />
    );
  }

  const singleOption = data.proposals.length === 1;

  return (
    <div className="space-y-6">
      {singleOption && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">Une seule répartition possible</p>
          <p className="text-muted-foreground mt-1">
            Les préférences actuelles ne permettent qu&apos;un seul planning. Il
            reste valable et peut être validé. Si vous préférez, proposez un
            second tour ci-dessous pour rouvrir la collecte aux familles
            concernées.
          </p>
        </div>
      )}

      <AdminDecision
        cycleId={cycleId}
        familyCount={familyCount}
        proposals={data.proposals.map((p, i) => ({
          id: p.id,
          index: i + 1,
          globalScore: p.globalScore,
          voteCount: p.voteCount ?? 0,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposer un second tour</CardTitle>
          <CardDescription>
            Si la répartition ne convient pas (ou qu&apos;une seule est
            possible), rouvrez la collecte pour les familles concernées, puis
            relancez la génération. Les familles en concurrence sur une semaine
            très demandée sont pré-cochées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SecondRoundProposer cycleId={cycleId} candidates={suggestions} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Carte « décision prise » réutilisée par le vote (§4.6) et la médiation (§4.7). */
function DecidedCard({
  cycleId,
  annee,
  data,
  adminId,
}: {
  cycleId: string;
  annee: number;
  data: NonNullable<Awaited<ReturnType<typeof getVoteData>>>;
  adminId: string;
}) {
  const idx =
    data.proposals.findIndex((p) => p.id === data.finalScheduleProposalId) + 1;
  const parVote = data.finalDecidePar !== "admin";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Décision prise — {annee}</CardTitle>
        <CardDescription>
          {parVote
            ? `Proposition ${idx} retenue (issue du vote).`
            : "Planning arrêté (décision admin)."}{" "}
          Le planning est verrouillé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FinalPlanning data={data} myUserId={adminId} />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/semaines-libres">
              Gérer les semaines disponibles →
            </Link>
          </Button>
        </div>
        <form action={closeCycle}>
          <input type="hidden" name="cycleId" value={cycleId} />
          <Button type="submit" variant="outline">
            Clôturer le cycle
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          La clôture archive le cycle (il alimente alors l&apos;historique),
          ferme l&apos;attribution des semaines disponibles et permet d&apos;en
          démarrer un nouveau.
        </p>
      </CardContent>
    </Card>
  );
}

/** Vue admin en médiation (spec section 4.7.2) : décidée, ou grille d'arbitrage. */
async function MediationView({
  cycleId,
  adminId,
  annee,
  propertyId,
}: {
  cycleId: string;
  adminId: string;
  annee: number;
  propertyId: string;
}) {
  const voteData = await getVoteData(cycleId, adminId, propertyId, true);
  if (voteData?.finalScheduleProposalId) {
    return (
      <DecidedCard
        cycleId={cycleId}
        annee={annee}
        data={voteData}
        adminId={adminId}
      />
    );
  }

  const data = await getMediationData(cycleId, propertyId);
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Médiation — {annee}</CardTitle>
          <CardDescription>
            Aucun planning satisfaisant n&apos;a pu être généré. Attribuez
            manuellement les semaines en vous appuyant sur les préférences
            (visibles ci-dessous), avec une justification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediationGrid data={data} />
        </CardContent>
      </Card>

      <RestartCard cycleId={cycleId} />
    </div>
  );
}

/** Bouton de redémarrage complet du cycle (spec section 4.7.3). */
function RestartCard({ cycleId }: { cycleId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Redémarrer le cycle</CardTitle>
        <CardDescription>
          Remet tout à zéro (préférences, propositions, décision) et repasse en
          configuration. Vous pourrez ajuster la période puis relancer la
          collecte (nouvelle invitation aux familles).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={forceRestart}>
          <input type="hidden" name="cycleId" value={cycleId} />
          <Button type="submit" variant="destructive" size="sm">
            Redémarrer à zéro
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Vue de suivi + déclenchement de la génération (statut collecte). */
async function CollecteView({
  cycleId,
  propertyId,
  annee,
  statut,
}: {
  cycleId: string;
  propertyId: string;
  annee: number;
  statut: string;
}) {
  const rows = await getCompletion(cycleId, propertyId);
  const done = rows.filter((r) => r.responded).length;
  const allResponded = done === rows.length;
  const secondRound = statut === "collecte_tour2";

  return (
    <div className="space-y-6">
      {allResponded && (
        <div className="border-good/30 bg-good/10 flex items-start gap-2.5 rounded-lg border p-4">
          <CheckCircle2 className="text-good mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="text-good font-medium">
              Toutes les familles ont répondu.
            </p>
            <p className="text-muted-foreground mt-0.5">
              Vous pouvez lancer la génération des plannings ci-dessous.
            </p>
          </div>
        </div>
      )}
      {secondRound && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">Second tour en cours</p>
          <p className="text-muted-foreground mt-1">
            Seules les familles concernées peuvent ajuster leurs préférences.
            Relancez la génération une fois leurs réponses reçues ; en cas de
            nouvel échec, le cycle passera en médiation.
          </p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {secondRound ? "Second tour" : "Collecte"} {annee} — {done}/
            {rows.length} réponse{rows.length > 1 ? "s" : ""}
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

      {secondRound && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Débloquer manuellement</CardTitle>
            <CardDescription>
              Si le second tour n&apos;aboutit pas, passez en médiation (arbitrage
              manuel) ou redémarrez le cycle depuis zéro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action={goToMediation}>
              <input type="hidden" name="cycleId" value={cycleId} />
              <Button type="submit" variant="outline" size="sm">
                Passer en médiation
              </Button>
            </form>
            <form action={forceRestart}>
              <input type="hidden" name="cycleId" value={cycleId} />
              <Button type="submit" variant="destructive" size="sm">
                Redémarrer à zéro
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
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
