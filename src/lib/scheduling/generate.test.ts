import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchedules, compareLeximin, canTakeTwoWeeks } from "./generate";
import type { GenerateInput, FamilyInput, ScoredCombination } from "./types";

/** Petit utilitaire : construit une entrée avec valeurs par défaut. */
function input(partial: Partial<GenerateInput>): GenerateInput {
  return {
    weekCount: partial.weekCount ?? 0,
    families: partial.families ?? [],
    seuilScoreMinimum: partial.seuilScoreMinimum ?? 40,
    timeBudgetMs: partial.timeBudgetMs,
  };
}

test("notation de base : deux familles à 1 semaine, propose le meilleur global", () => {
  const result = generateSchedules(
    input({
      weekCount: 2,
      families: [
        { id: "A", rightWeeks: 1, acceptsSplit: false, prefs: { 0: "preferee", 1: "non_coche" } },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: { 0: "non_coche", 1: "preferee" } },
      ],
    }),
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  // Deux combinaisons valides (100/100 et 40/40).
  assert.equal(result.proposals.length, 2);
  // La meilleure est présentée en premier.
  assert.equal(result.proposals[0].globalScore, 100);
  assert.equal(result.proposals[1].globalScore, 40);
});

test("fractionnement forcé : score forfaitaire 30% + variantes à score égal conservées (plafond par palier)", () => {
  const result = generateSchedules(
    input({
      weekCount: 3,
      seuilScoreMinimum: 40,
      families: [
        // A accepte le fractionnement mais ne demande pas de split volontaire.
        { id: "A", rightWeeks: 2, acceptsSplit: true, prefs: {} },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: {} },
      ],
    }),
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  // Deux façons d'obtenir {A:40,B:40} (A prend les semaines {0,1} ou {1,2}) :
  // le plafond par palier (2 variantes max) les conserve TOUTES LES DEUX au
  // lieu d'en masquer une (spec §4.5, étape 3). Plus la combinaison au split
  // forcé {A30,B40}. Total : 3 propositions.
  assert.equal(result.proposals.length, 3);

  const tied = result.proposals.filter(
    (p) => p.assignments.find((a) => a.familyId === "A")!.score === 40,
  );
  assert.equal(tied.length, 2, "les deux variantes à 40% doivent être conservées");
  const aWeeksVariants = tied
    .map((p) => [...p.assignments.find((a) => a.familyId === "A")!.weeks].sort().join(","))
    .sort();
  assert.deepEqual(aWeeksVariants, ["0,1", "1,2"]);

  const forced = result.proposals
    .flatMap((p) => p.assignments)
    .find((a) => a.familyId === "A" && a.forcedSplit);
  assert.ok(forced, "une attribution en fractionnement forcé doit exister");
  assert.equal(forced.score, 30);
  assert.equal(forced.weeks.length, 2);
});

test("une variante à score égal mais semaines différentes n'est plus effacée par une option strictement moins bonne", () => {
  // A et B préfèrent tous les deux les semaines 0 et 1 (2 et 3 par défaut).
  // Deux façons d'obtenir 100% pour les deux (A=0/B=1 ou A=1/B=0), plus des
  // combinaisons nettement moins bonnes si l'une des familles doit se
  // contenter d'une semaine « sans préférence ». Avant le correctif, la
  // seconde variante à 100% était supprimée (dédup par profil de score) et
  // remplacée par une option plus faible ; elle doit maintenant être conservée.
  const result = generateSchedules(
    input({
      weekCount: 4,
      families: [
        { id: "A", rightWeeks: 1, acceptsSplit: false, prefs: { 0: "preferee", 1: "preferee" } },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: { 0: "preferee", 1: "preferee" } },
      ],
    }),
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const best = result.proposals.filter((p) => p.globalScore === 100);
  assert.equal(best.length, 2, "les deux variantes à 100% doivent être conservées");

  const weeksOfA = best
    .map((p) => p.assignments.find((a) => a.familyId === "A")!.weeks[0])
    .sort((a, b) => a - b);
  assert.deepEqual(weeksOfA, [0, 1], "A obtient une semaine différente selon la variante");
});

test("fractionnement volontaire (deux 'préférée') : noté normalement, pas 30%", () => {
  const result = generateSchedules(
    input({
      weekCount: 3,
      families: [
        // acceptsSplit=false, mais A marque week0 et week2 « préférée » → volontaire.
        {
          id: "A",
          rightWeeks: 2,
          acceptsSplit: false,
          prefs: { 0: "preferee", 1: "non_coche", 2: "preferee" },
        },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: {} },
      ],
    }),
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const top = result.proposals[0];
  const a = top.assignments.find((x) => x.familyId === "A");
  assert.ok(a);
  // Split volontaire de deux semaines « préférée » → moyenne 100, non forcé.
  assert.equal(a.score, 100);
  assert.equal(a.forcedSplit, false);
  assert.deepEqual([...a.weeks].sort(), [0, 2]);
});

test("canTakeTwoWeeks : reflète les contraintes propres de la famille", () => {
  const fam = (p: Partial<FamilyInput>): FamilyInput => ({
    id: "A",
    rightWeeks: 2,
    acceptsSplit: false,
    prefs: {},
    ...p,
  });
  // Droit à 1 semaine → jamais éligible à 2.
  assert.equal(canTakeTwoWeeks(fam({ rightWeeks: 1 }), 3), false);
  // Deux semaines libres adjacentes → oui.
  assert.equal(canTakeTwoWeeks(fam({}), 3), true);
  // Une seule semaine utilisable (le reste impossible) → non.
  assert.equal(
    canTakeTwoWeeks(fam({ prefs: { 1: "impossible", 2: "impossible" } }), 3),
    false,
  );
  // Deux semaines utilisables mais non contiguës, sans acceptation du split → non.
  assert.equal(canTakeTwoWeeks(fam({ prefs: { 1: "impossible" } }), 3), false);
  // Idem mais les deux « préférée » (split volontaire) → oui.
  assert.equal(
    canTakeTwoWeeks(
      fam({ prefs: { 0: "preferee", 1: "impossible", 2: "preferee" } }),
      3,
    ),
    true,
  );
  // Idem mais la famille accepte le fractionnement → oui.
  assert.equal(
    canTakeTwoWeeks(fam({ acceptsSplit: true, prefs: { 1: "impossible" } }), 3),
    true,
  );
});

test("2 semaines sans appariement valide → famille ramenée à 1 semaine", () => {
  // A a droit à 2 semaines, mais week1 est impossible et A refuse le split :
  // l'appariement {0,2} est non contigu et non volontaire → invalide. Plutôt que
  // de faire échouer le cycle, A doit recevoir une seule semaine (spec §4.2).
  const result = generateSchedules(
    input({
      weekCount: 3,
      families: [
        {
          id: "A",
          rightWeeks: 2,
          acceptsSplit: false,
          prefs: { 0: "preferee", 1: "impossible", 2: "non_coche" },
        },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: { 2: "preferee" } },
      ],
    }),
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const a = result.proposals[0].assignments.find((x) => x.familyId === "A");
  assert.ok(a, "A doit être placée");
  assert.equal(a.weeks.length, 1, "A ne reçoit qu'une semaine");
  assert.equal(a.forcedSplit, false);
});

test("départage leximin : à global égal, la répartition la plus équitable gagne", () => {
  const a: ScoredCombination = {
    assignments: [],
    globalScore: 70,
    minScore: 40,
    sortedScores: [40, 100],
  };
  const b: ScoredCombination = {
    assignments: [],
    globalScore: 70,
    minScore: 60,
    sortedScores: [60, 80],
  };
  // b sert mieux la famille la moins bien lotie → b classée avant a.
  assert.ok(compareLeximin(a, b) > 0);
  assert.ok(compareLeximin(b, a) < 0);
  // Profils strictement identiques → 0.
  assert.equal(compareLeximin(a, { ...a }), 0);
});

test("meilleur score minimum sous le seuil → mode de secours 'sous_seuil'", () => {
  const result = generateSchedules(
    input({
      weekCount: 1,
      seuilScoreMinimum: 50,
      families: [
        { id: "A", rightWeeks: 1, acceptsSplit: false, prefs: { 0: "non_coche" } },
      ],
    }),
  );

  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  assert.equal(result.reason, "sous_seuil");
});

test("délai de calcul dépassé sans combinaison → mode de secours 'timeout'", () => {
  const result = generateSchedules(
    input({
      weekCount: 2,
      timeBudgetMs: -1, // deadline déjà dépassée → arrêt immédiat.
      families: [
        { id: "A", rightWeeks: 1, acceptsSplit: false, prefs: {} },
        { id: "B", rightWeeks: 1, acceptsSplit: false, prefs: {} },
      ],
    }),
  );

  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  assert.equal(result.reason, "timeout");
});

test("aucune famille active (toutes en opt-out) → secours", () => {
  const result = generateSchedules(input({ weekCount: 3, families: [] }));
  assert.equal(result.status, "fallback");
});
