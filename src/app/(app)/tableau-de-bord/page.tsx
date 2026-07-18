import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Lock,
  Sparkles,
  Vote as VoteIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getCompletion } from "@/lib/cycles/service";
import { getDecidedCycle, getUnclaimedWeekIds } from "@/lib/unclaimed/service";
import { getVoteData, type VoteData } from "@/lib/vote/service";
import { getFamilyStats } from "@/lib/stats/history";
import { FinalPlanning } from "../vote/final-planning";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUT_LABELS: Record<string, string> = {
  config: "Configuration",
  collecte: "Collecte des préférences",
  collecte_tour2: "Second tour",
  generation: "Génération",
  vote: "Vote en cours",
  mediation: "Médiation",
  cloture: "Clôturé",
};

const STEPS = ["Configuration", "Collecte", "Vote", "Clôture"];
function stepIndex(statut: string): number {
  if (statut === "config") return 0;
  if (statut === "collecte" || statut === "collecte_tour2") return 1;
  if (statut === "cloture") return 3;
  return 2; // generation / vote / mediation
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function DashboardPage() {
  const user = await requireUser();
  // Cycle actif + dernier cycle décidé, en parallèle (moins d'attente réseau).
  const [cycle, decidedCycle] = await Promise.all([
    getActiveCycle(user.propertyId),
    getDecidedCycle(user.propertyId),
  ]);

  // Le planning validé n'est affiché ici que s'il n'y a pas de cycle actif, ou
  // si le cycle actif EST le cycle décidé. Inutile de charger la grille (requête
  // lourde) dans les autres cas.
  const showPlanning =
    !!decidedCycle && (!cycle || cycle.id === decidedCycle.id);
  // Les semaines disponibles ne se pilotent que tant que le cycle décidé n'est
  // pas clôturé (fonction fermée après clôture, §4.9).
  const unclaimedOpen = !!decidedCycle && decidedCycle.statut !== "cloture";
  const [unclaimedCount, decidedData, stats] = await Promise.all([
    unclaimedOpen
      ? getUnclaimedWeekIds(decidedCycle.id).then((w) => w.length)
      : 0,
    showPlanning ? getVoteData(decidedCycle.id, user.id) : null,
    getFamilyStats(user.propertyId),
  ]);
  const myStats = stats.find((s) => s.userId === user.id) ?? null;
  const finalPlanning =
    decidedData && decidedData.finalScheduleProposalId ? decidedData : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {!cycle ? (
        <NoCycle
          isAdmin={user.isAdmin}
          unclaimedCount={unclaimedCount}
          finalPlanning={finalPlanning}
          myUserId={user.id}
        />
      ) : (
        <ActiveDashboard
          user={user}
          cycle={cycle}
          unclaimedCount={unclaimedCount}
          myStats={myStats}
          finalPlanning={
            finalPlanning && finalPlanning.cycleId === cycle.id
              ? finalPlanning
              : null
          }
        />
      )}
    </main>
  );
}

function NoCycle({
  isAdmin,
  unclaimedCount,
  finalPlanning,
  myUserId,
}: {
  isAdmin: boolean;
  unclaimedCount: number;
  finalPlanning: VoteData | null;
  myUserId: string;
}) {
  return (
    <div className="space-y-6">
      {finalPlanning && (
        <section className="space-y-4">
          <div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <CheckCircle2 className="text-good size-3.5" /> Planning validé
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              Vacances {finalPlanning.annee}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Le cycle est clôturé. Voici la répartition retenue.
            </p>
          </div>
          <FinalPlanning data={finalPlanning} myUserId={myUserId} />
        </section>
      )}
      <div className="rounded-xl border border-dashed py-16 text-center">
        <div className="text-muted-foreground mx-auto mb-4 grid size-12 place-items-center rounded-xl border">
          <CalendarX2 className="size-5" />
        </div>
        <h2 className="text-base font-semibold">Aucun cycle en cours</h2>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
          {isAdmin
            ? "Configurez le cycle de l'année pour lancer la collecte des préférences auprès des familles."
            : "Vous serez notifié·e par e-mail dès que la collecte des préférences sera ouverte."}
        </p>
        {isAdmin && (
          <Button asChild className="mt-5">
            <Link href="/admin">Configurer le cycle</Link>
          </Button>
        )}
      </div>
      {unclaimedCount > 0 && (
        <Button asChild variant="outline">
          <Link href="/semaines-libres">
            {unclaimedCount} semaine{unclaimedCount > 1 ? "s" : ""} disponible
            {unclaimedCount > 1 ? "s" : ""} →
          </Link>
        </Button>
      )}
    </div>
  );
}

async function ActiveDashboard({
  user,
  cycle,
  unclaimedCount,
  myStats,
  finalPlanning,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
  cycle: NonNullable<Awaited<ReturnType<typeof getActiveCycle>>>;
  unclaimedCount: number;
  myStats: Awaited<ReturnType<typeof getFamilyStats>>[number] | null;
  finalPlanning: VoteData | null;
}) {
  const inCollecte =
    cycle.statut === "collecte" || cycle.statut === "collecte_tour2";
  const inVote = cycle.statut === "vote" || cycle.statut === "mediation";

  const [completion, right, optOut, myVote, finalSchedule, secondRoundParticipants] =
    await Promise.all([
      getCompletion(cycle.id, user.propertyId),
      prisma.familyRight.findUnique({
        where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        select: { soumisLe: true },
      }),
      prisma.optOut.findUnique({
        where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        select: { id: true },
      }),
      prisma.vote.findUnique({
        where: { cycleId_userId: { cycleId: cycle.id, userId: user.id } },
        select: { id: true },
      }),
      prisma.finalSchedule.findUnique({
        where: { cycleId: cycle.id },
        select: { id: true },
      }),
      cycle.statut === "collecte_tour2"
        ? prisma.secondRoundParticipant.findMany({
            where: { cycleId: cycle.id },
            select: { userId: true },
          })
        : Promise.resolve([]),
    ]);

  const decided = finalSchedule !== null;
  const responded = optOut !== null || (right?.soumisLe ?? null) !== null;
  // Second tour (§4.7.1) : familles ciblées (doivent ré-ajuster) et celles encore
  // en attente parmi elles. Les autres familles sont verrouillées à ce tour.
  const participantIds = new Set(secondRoundParticipants.map((p) => p.userId));
  const iAmParticipant = participantIds.has(user.id);
  const secondRoundLocked =
    cycle.statut === "collecte_tour2" && !iAmParticipant;
  const pendingParticipants = completion.filter(
    (r) => participantIds.has(r.userId) && !r.responded,
  ).length;
  const doneCount = completion.filter((r) => r.responded).length;

  // Meilleur score global : requête légère (pas besoin de charger tout le vote).
  let topGlobal: number | null = null;
  if (inVote) {
    const best = await prisma.scheduleProposal.findFirst({
      where: { cycleId: cycle.id },
      orderBy: { scoreGlobal: "desc" },
      select: { scoreGlobal: true },
    });
    topGlobal = best?.scoreGlobal ?? null;
  }

  // Notification admin (§4.3 / §4.6) : toutes les familles ont répondu / voté.
  const familyCount = completion.length;
  const allResponded =
    inCollecte && familyCount > 0 && doneCount === familyCount;
  let allVoted = false;
  // Une fois la décision prise (planning validé), on ne montre plus « tout le
  // monde a voté » : la notification a fait son office.
  if (user.isAdmin && cycle.statut === "vote" && !decided) {
    const voteCount = await prisma.vote.count({ where: { cycleId: cycle.id } });
    allVoted = familyCount > 0 && voteCount >= familyCount;
  }
  const adminReady = user.isAdmin && (allResponded || allVoted);

  const deadlineIso = inCollecte
    ? cycle.deadlinePreferences?.toISOString()
    : inVote
      ? cycle.deadlineVote?.toISOString()
      : null;

  const step = stepIndex(cycle.statut);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Cycle en cours
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Vacances {cycle.annee}
          </h1>
          <ol className="mt-4 flex flex-wrap items-center gap-y-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center">
                <span
                  className={
                    i === step
                      ? "text-foreground flex items-center gap-2 text-xs font-semibold"
                      : i < step
                        ? "text-muted-foreground flex items-center gap-2 text-xs"
                        : "text-muted-foreground/50 flex items-center gap-2 text-xs"
                  }
                >
                  <span
                    className={
                      i <= step
                        ? "bg-foreground text-background grid size-5 place-items-center rounded-full text-[11px]"
                        : "grid size-5 place-items-center rounded-full border text-[11px]"
                    }
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
                {i < STEPS.length - 1 && (
                  <span className="bg-border mx-2 hidden h-px w-6 sm:block sm:w-8" />
                )}
              </li>
            ))}
          </ol>
        </div>
        <span className="bg-card inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <span className="bg-good size-1.5 rounded-full" />
          {STATUT_LABELS[cycle.statut] ?? cycle.statut}
        </span>
      </div>

      {cycle.statut === "collecte_tour2" && (
        <SecondRoundBanner
          iAmParticipant={iAmParticipant}
          responded={responded}
          pending={pendingParticipants}
        />
      )}

      {adminReady && (
        <div className="border-good/30 bg-good/10 flex flex-wrap items-center gap-3 rounded-xl border p-4">
          <CheckCircle2 className="text-good size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-good text-sm font-semibold">
              {allResponded
                ? "Toutes les familles ont répondu."
                : "Toutes les familles ont voté."}
            </p>
            <p className="text-muted-foreground text-sm">
              {allResponded
                ? "Vous pouvez lancer la génération des plannings."
                : "Vous pouvez arrêter la décision."}
            </p>
          </div>
          <Button asChild size="sm" className="ml-auto">
            <Link href="/admin">Ouvrir l&apos;administration →</Link>
          </Button>
        </div>
      )}

      {finalPlanning && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <CheckCircle2 className="text-good size-3.5" /> Planning validé
            </p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/vote">Ouvrir le planning →</Link>
            </Button>
          </div>
          <FinalPlanning data={finalPlanning} myUserId={user.id} />
        </section>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MySituation
          decided={decided}
          inVote={inVote}
          inCollecte={inCollecte}
          statut={cycle.statut}
          responded={responded}
          voted={myVote !== null}
          secondRoundLocked={secondRoundLocked}
          isAdmin={user.isAdmin}
        />

        <Tile
          k="Réponses reçues"
          icon={<ClipboardList className="size-4" />}
          value={
            <>
              {doneCount}
              <span className="text-muted-foreground text-sm font-medium">
                {" "}
                / {completion.length} familles
              </span>
            </>
          }
        >
          <div className="bg-accent mt-3 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full"
              style={{
                width: `${completion.length ? (doneCount / completion.length) * 100 : 0}%`,
              }}
            />
          </div>
        </Tile>

        {deadlineIso ? (
          <Tile
            k={inVote ? "Échéance du vote" : "Échéance des préférences"}
            icon={<CalendarClock className="size-4" />}
            value={fmtDate(deadlineIso)}
          >
            <p className="text-muted-foreground mt-1.5 text-xs">
              {(() => {
                const d = daysUntil(deadlineIso);
                return d > 0
                  ? `Dans ${d} jour${d > 1 ? "s" : ""}.`
                  : d === 0
                    ? "Aujourd'hui."
                    : "Échéance dépassée.";
              })()}
            </p>
          </Tile>
        ) : topGlobal !== null ? (
          <Tile
            k="Meilleure proposition"
            icon={<Sparkles className="size-4" />}
            value={`${Math.round(topGlobal)} %`}
          >
            <p className="text-muted-foreground mt-1.5 text-xs">
              Satisfaction globale — à confirmer par le vote.
            </p>
          </Tile>
        ) : null}

        {unclaimedCount > 0 ? (
          <Tile
            k="Semaines disponibles"
            icon={<CalendarClock className="size-4" />}
            value={String(unclaimedCount)}
          >
            <Button asChild variant="ghost" size="sm" className="mt-1.5 -ml-3">
              <Link href="/semaines-libres">Voir →</Link>
            </Button>
          </Tile>
        ) : (
          <Tile
            k="Votre satisfaction moyenne"
            icon={<Sparkles className="size-4" />}
            value={
              myStats?.avgSatisfaction != null
                ? `${Math.round(myStats.avgSatisfaction)} %`
                : "—"
            }
          >
            <p className="text-muted-foreground mt-1.5 text-xs">
              Sur les 5 dernières années.
            </p>
          </Tile>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Votre historique</CardTitle>
          <CardDescription>Sur les 5 dernières années.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-10 gap-y-4">
          <Stat
            label="Fois avec 2 semaines"
            value={String(myStats?.timesWith2Weeks ?? 0)}
          />
          <Stat
            label="Dernière fois"
            value={myStats?.lastYearWith2Weeks?.toString() ?? "—"}
          />
          <Stat
            label="Satisfaction moyenne"
            value={
              myStats?.avgSatisfaction != null
                ? `${Math.round(myStats.avgSatisfaction)} %`
                : "—"
            }
          />
          <div className="ml-auto self-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/historique">Voir l&apos;historique complet</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Bandeau ambre du second tour (§4.7.1), différencié selon le rôle de la famille. */
function SecondRoundBanner({
  iAmParticipant,
  responded,
  pending,
}: {
  iAmParticipant: boolean;
  responded: boolean;
  pending: number;
}) {
  let title: string;
  let body: string;
  let cta: { href: string; label: string } | null = null;

  if (iAmParticipant && !responded) {
    title = "Second tour — votre ajustement est requis";
    body =
      "Aucun planning satisfaisant n'a été trouvé au premier tour. Ajustez vos préférences sur les semaines en tension pour aider à dégager une solution.";
    cta = { href: "/preferences", label: "Ajuster mes préférences →" };
  } else if (iAmParticipant && responded) {
    title = "Second tour — préférences ajustées";
    body =
      pending > 0
        ? `Merci. En attente de ${pending} autre${pending > 1 ? "s" : ""} famille${pending > 1 ? "s" : ""} avant la nouvelle génération.`
        : "Merci. Toutes les familles concernées ont répondu ; la nouvelle génération peut être lancée.";
  } else {
    // Famille verrouillée (non concernée par le second tour).
    title = "Second tour en cours";
    body =
      pending > 0
        ? `${pending} famille${pending > 1 ? "s" : ""} doi${pending > 1 ? "vent" : "t"} ajuster leurs préférences avant la nouvelle génération. Vos préférences restent inchangées.`
        : "Les familles concernées ont toutes répondu ; la nouvelle génération peut être lancée. Vos préférences restent inchangées.";
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
      <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {title}
        </p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      {cta && (
        <Button asChild size="sm" className="ml-auto">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

function MySituation({
  decided,
  inVote,
  inCollecte,
  statut,
  responded,
  voted,
  secondRoundLocked,
  isAdmin,
}: {
  decided: boolean;
  inVote: boolean;
  inCollecte: boolean;
  statut: string;
  responded: boolean;
  voted: boolean;
  secondRoundLocked: boolean;
  isAdmin: boolean;
}) {
  let icon = <ClipboardList className="size-4" />;
  let value = "À faire";
  let desc = "";
  let cta: { href: string; label: string } | null = null;

  if (decided) {
    icon = <CheckCircle2 className="text-good size-4" />;
    value = "Planning arrêté";
    desc = "La répartition est confirmée.";
    cta = { href: "/vote", label: "Voir le planning →" };
  } else if (inVote && statut === "mediation") {
    icon = <Lock className="size-4" />;
    value = "Médiation";
    desc = isAdmin
      ? "Arbitrage manuel requis."
      : "L'administrateur arbitre la répartition.";
    cta = isAdmin ? { href: "/admin", label: "Ouvrir la médiation →" } : null;
  } else if (inVote) {
    icon = voted ? (
      <CheckCircle2 className="text-good size-4" />
    ) : (
      <VoteIcon className="size-4" />
    );
    value = voted ? "Vous avez voté" : "À voter";
    desc = voted
      ? "Modifiable jusqu'à l'échéance."
      : "Choisissez votre proposition préférée.";
    cta = { href: "/vote", label: voted ? "Modifier mon vote →" : "Voter →" };
  } else if (inCollecte && secondRoundLocked) {
    icon = <Lock className="size-4" />;
    value = "Second tour";
    desc = "Vos préférences sont verrouillées à ce tour.";
  } else if (inCollecte) {
    icon = responded ? (
      <CheckCircle2 className="text-good size-4" />
    ) : (
      <ClipboardList className="size-4" />
    );
    value = responded ? "Vous avez répondu" : "À compléter";
    desc = responded
      ? "Modifiable jusqu'à la clôture."
      : "Renseignez vos préférences.";
    cta = {
      href: "/preferences",
      label: responded
        ? "Modifier mes préférences →"
        : "Saisir mes préférences →",
    };
  } else {
    icon = <CalendarClock className="size-4" />;
    value = "En préparation";
    desc = isAdmin
      ? "Finalisez la configuration."
      : "Rien à faire pour l'instant.";
    cta = isAdmin ? { href: "/admin", label: "Configurer →" } : null;
  }

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {icon} Ma situation
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      {desc && <p className="text-muted-foreground mt-1 text-xs">{desc}</p>}
      {cta && (
        <Button asChild size="sm" className="mt-3.5">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

function Tile({
  k,
  icon,
  value,
  children,
}: {
  k: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {icon} {k}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
