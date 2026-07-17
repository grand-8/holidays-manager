import { FileClock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { AdminTabs } from "@/components/admin-tabs";

const CHAMP_LABELS: Record<string, string> = {
  nombreSemaines: "nombre de semaines",
  email: "adresse e-mail",
};

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function JournalPage() {
  await requireAdmin();
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-xl font-semibold">Administration</h1>
      <AdminTabs />

      <p className="text-muted-foreground mb-4 text-sm">
        Toute correction de données archivées est tracée ici (qui, quand, avant →
        après). Ce journal est en ajout seul : rien n&apos;y est jamais modifié
        ni supprimé.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <div className="text-muted-foreground mx-auto mb-4 grid size-12 place-items-center rounded-xl border">
            <FileClock className="size-5" />
          </div>
          <h2 className="text-base font-semibold">Aucune entrée</h2>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
            Les corrections apportées à l&apos;historique ou aux comptes
            apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border">
          {entries.map((e, i) => (
            <div
              key={e.id}
              className={cnBorder(i)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {e.tableConcernee} · {CHAMP_LABELS[e.champ] ?? e.champ}
                </div>
                <div className="text-muted-foreground mt-0.5 truncate text-xs">
                  <span className="line-through">{e.ancienneValeur ?? "∅"}</span>{" "}
                  → <span className="text-foreground">{e.nouvelleValeur ?? "∅"}</span>{" "}
                  · {e.modifiePar}
                </div>
              </div>
              <time className="text-muted-foreground/70 shrink-0 font-mono text-xs">
                {fmt(e.createdAt)}
              </time>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function cnBorder(i: number): string {
  return `flex items-center justify-between gap-4 px-4 py-3 ${i > 0 ? "border-t" : ""}`;
}
