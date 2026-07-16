import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getActiveCycle } from "@/lib/cycles/service";
import { getConfigHistory } from "@/lib/stats/history";
import { computeWeekSlots } from "@/lib/scheduling/weeks";
import { DEFAULT_SEUIL_SCORE_MINIMUM } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { CreateCycleForm } from "./create-cycle-form";
import { CycleConfig } from "./cycle-config";

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
      ) : (
        <section className="space-y-2">
          <p className="text-sm">
            Cycle <strong>{cycle.annee}</strong> — statut :{" "}
            <strong>{STATUT_LABELS[cycle.statut] ?? cycle.statut}</strong>
          </p>
          <p className="text-muted-foreground text-sm">
            La suite (suivi de complétion, génération, vote) sera pilotée depuis
            cet écran. (En cours de construction.)
          </p>
        </section>
      )}
    </main>
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
