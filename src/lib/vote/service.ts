import { prisma } from "@/lib/prisma";

/**
 * Données du vote (spec section 4.6).
 * Confidentialité : une famille voit le planning complet (qui a quelle semaine),
 * le score GLOBAL de chaque proposition et les PRÉFÉRENCES de toutes les familles
 * (rendues visibles après la génération, §4.3 — utile pour voter en connaissance
 * de cause), mais uniquement SON propre score individuel — jamais celui des
 * autres familles.
 */

export type ProposalWeek = {
  ordre: number;
  dateDebut: string;
  dateFin: string;
};

export type ProposalFamily = {
  userId: string;
  nomAffiche: string;
  weeks: ProposalWeek[];
  /** Score individuel de la famille dans cette proposition (0–100). */
  score: number;
};

export type ProposalView = {
  id: string;
  globalScore: number;
  /** Score minimum du planning (indicateur d'équité) — agrégé, n'identifie personne. */
  minScore: number;
  families: ProposalFamily[];
  /** Score individuel de la famille courante, ou null (opt-out / non assignée). */
  myScore: number | null;
  /** Nombre de votes (fourni uniquement pour l'admin). */
  voteCount?: number;
};

export type VoteData = {
  cycleId: string;
  annee: number;
  statut: string;
  deadlineVote: string | null;
  myVoteProposalId: string | null;
  proposals: ProposalView[];
  /** Toutes les semaines du cycle (colonnes de la grille), triées. */
  weeks: ProposalWeek[];
  /**
   * Préférences de la famille courante par ordre de semaine (compat + légende).
   */
  myPrefs: Record<number, string>;
  /**
   * Préférences de TOUTES les familles : userId → (ordre → statut). Colore chaque
   * ligne de la grille par les préférences de la famille correspondante (§4.6 —
   * visibles après génération, aide au vote). Les scores restent privés.
   */
  prefsByUser: Record<string, Record<number, string>>;
  finalScheduleProposalId: string | null;
  finalCommentaire: string | null;
  finalDecidePar: string | null;
};

/** Charge les données de vote d'un cycle pour la famille `userId`. */
export async function getVoteData(
  cycleId: string,
  userId: string,
  includeVoteCounts = false,
): Promise<VoteData | null> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      weekSlots: { orderBy: { ordre: "asc" } },
      proposals: {
        orderBy: { scoreGlobal: "desc" },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, nomAffiche: true } },
              weekSlot: { select: { ordre: true, dateDebut: true, dateFin: true } },
            },
          },
          votes: includeVoteCounts,
        },
      },
      preferences: true,
      finalSchedule: true,
      votes: { where: { userId } },
    },
  });
  if (!cycle) return null;

  // Colonnes de la grille = toutes les semaines du cycle.
  const weeks: ProposalWeek[] = cycle.weekSlots.map((w) => ({
    ordre: w.ordre,
    dateDebut: w.dateDebut.toISOString(),
    dateFin: w.dateFin.toISOString(),
  }));
  // Préférences de toutes les familles par ordre de semaine (pour colorer
  // chaque ligne de la grille). Les scores restent, eux, privés.
  const ordreByWeekSlot = new Map(cycle.weekSlots.map((w) => [w.id, w.ordre]));
  const prefsByUser: Record<string, Record<number, string>> = {};
  for (const p of cycle.preferences) {
    const ordre = ordreByWeekSlot.get(p.weekSlotId);
    if (ordre === undefined) continue;
    (prefsByUser[p.userId] ??= {})[ordre] = p.statut;
  }
  const myPrefs: Record<number, string> = prefsByUser[userId] ?? {};

  const proposals: ProposalView[] = cycle.proposals.map((p) => {
    // Regroupe les semaines par famille.
    const byFamily = new Map<string, ProposalFamily>();
    let myScore: number | null = null;
    for (const a of p.assignments) {
      if (a.userId === userId) myScore = a.scoreIndividuel;
      const fam =
        byFamily.get(a.userId) ??
        ({
          userId: a.userId,
          nomAffiche: a.user.nomAffiche,
          weeks: [],
          // Le score individuel est identique sur toutes les semaines d'une
          // même famille (§4.5) ; on le reprend tel quel.
          score: a.scoreIndividuel,
        } satisfies ProposalFamily);
      fam.weeks.push({
        ordre: a.weekSlot.ordre,
        dateDebut: a.weekSlot.dateDebut.toISOString(),
        dateFin: a.weekSlot.dateFin.toISOString(),
      });
      byFamily.set(a.userId, fam);
    }
    const families = [...byFamily.values()].map((f) => ({
      ...f,
      weeks: f.weeks.sort((x, y) => x.ordre - y.ordre),
    }));
    families.sort((a, b) => a.nomAffiche.localeCompare(b.nomAffiche));

    return {
      id: p.id,
      globalScore: p.scoreGlobal,
      minScore: p.scoreMinimum,
      families,
      myScore,
      voteCount: includeVoteCounts ? p.votes.length : undefined,
    };
  });

  return {
    cycleId: cycle.id,
    annee: cycle.annee,
    statut: cycle.statut,
    deadlineVote: cycle.deadlineVote?.toISOString() ?? null,
    myVoteProposalId: cycle.votes[0]?.scheduleProposalId ?? null,
    proposals,
    weeks,
    myPrefs,
    prefsByUser,
    finalScheduleProposalId: cycle.finalSchedule?.scheduleProposalId ?? null,
    finalCommentaire: cycle.finalSchedule?.commentaireAdmin ?? null,
    finalDecidePar: cycle.finalSchedule?.decidePar ?? null,
  };
}

/**
 * Détermine la proposition gagnante (spec section 4.6) : le plus de votes ;
 * en cas d'égalité, le meilleur score global. Gère l'absence totale de votes
 * (toutes à 0 → meilleur score global).
 */
export function pickWinner(
  proposals: { id: string; globalScore: number; voteCount: number }[],
): string | null {
  if (proposals.length === 0) return null;
  return [...proposals].sort(
    (a, b) => b.voteCount - a.voteCount || b.globalScore - a.globalScore,
  )[0].id;
}
