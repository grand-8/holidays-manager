import { prisma } from "@/lib/prisma";
import { generateSchedules } from "@/lib/scheduling/generate";
import type {
  FamilyInput,
  GenerateInput,
  GenerateResult,
  PreferenceStatus,
} from "@/lib/scheduling/types";

/**
 * Câblage entre les données du cycle et l'algorithme de génération (spec 4.5).
 * Les familles en opt-out ne sont pas passées à l'algorithme (spec section 4.2).
 */
export async function buildGenerateInput(
  cycleId: string,
): Promise<{ input: GenerateInput; ordreToWeekSlotId: Map<number, string> }> {
  const cycle = await prisma.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      weekSlots: { orderBy: { ordre: "asc" } },
      familyRights: true,
      optOuts: true,
      preferences: true,
    },
  });

  const optedOut = new Set(cycle.optOuts.map((o) => o.userId));
  const ordreByWeekSlotId = new Map(cycle.weekSlots.map((w) => [w.id, w.ordre]));
  const ordreToWeekSlotId = new Map(cycle.weekSlots.map((w) => [w.ordre, w.id]));

  const families: FamilyInput[] = cycle.familyRights
    .filter((r) => !optedOut.has(r.userId))
    .map((r) => ({
      id: r.userId,
      rightWeeks: r.nombreSemaines === 2 ? 2 : 1,
      acceptsSplit: r.accepteFractionnement,
      prefs: {} as Record<number, PreferenceStatus>,
    }));

  const familyById = new Map(families.map((f) => [f.id, f]));
  for (const p of cycle.preferences) {
    const fam = familyById.get(p.userId);
    if (!fam) continue; // préférences d'une famille en opt-out : ignorées
    const ordre = ordreByWeekSlotId.get(p.weekSlotId);
    if (ordre === undefined) continue;
    fam.prefs[ordre] = p.statut as PreferenceStatus;
  }

  const input: GenerateInput = {
    weekCount: cycle.weekSlots.length,
    families,
    seuilScoreMinimum: cycle.seuilScoreMinimum,
  };
  return { input, ordreToWeekSlotId };
}

/**
 * Persiste les propositions générées (ScheduleProposal + ScheduleAssignment).
 * Une attribution famille (1 ou 2 semaines) donne une ligne d'attribution par
 * semaine, avec le même score individuel et le même drapeau de fractionnement.
 */
async function persistProposals(
  cycleId: string,
  result: Extract<GenerateResult, { status: "ok" }>,
  ordreToWeekSlotId: Map<number, string>,
) {
  await prisma.$transaction(
    result.proposals.map((prop) =>
      prisma.scheduleProposal.create({
        data: {
          cycleId,
          scoreGlobal: prop.globalScore,
          scoreMinimum: prop.minScore,
          assignments: {
            create: prop.assignments.flatMap((a) =>
              a.weeks.map((ordre) => ({
                userId: a.familyId,
                weekSlotId: ordreToWeekSlotId.get(ordre)!,
                scoreIndividuel: a.score,
                fractionnementForce: a.forcedSplit,
              })),
            ),
          },
        },
      }),
    ),
  );
}

/**
 * Exécute la génération pour un cycle et persiste le résultat.
 * En cas de succès : crée les propositions et passe le cycle en « vote ».
 * En cas de secours : ne persiste rien, ne change pas le statut, renvoie la raison
 * (la cascade de secours §4.7 sera branchée ultérieurement).
 */
export async function runGeneration(cycleId: string): Promise<GenerateResult> {
  // On repart d'un état propre (ex. re-génération) : supprime les anciennes propositions.
  await prisma.scheduleProposal.deleteMany({ where: { cycleId } });

  const { input, ordreToWeekSlotId } = await buildGenerateInput(cycleId);
  const result = generateSchedules(input);

  if (result.status === "ok") {
    await persistProposals(cycleId, result, ordreToWeekSlotId);
    await prisma.cycle.update({
      where: { id: cycleId },
      data: { statut: "vote" },
    });
  }

  return result;
}
