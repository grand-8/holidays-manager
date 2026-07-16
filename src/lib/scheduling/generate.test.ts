import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchedules, compareLeximin } from "./generate";
import type { GenerateInput, ScoredCombination } from "./types";

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

test("fractionnement forcé : score forfaitaire 30% + dédup des profils identiques", () => {
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

  // Les deux combinaisons {A40,B40} ont un profil identique → une seule retenue.
  // Plus la combinaison au split forcé {A30,B40}. Total : 2 propositions.
  assert.equal(result.proposals.length, 2);

  const forced = result.proposals
    .flatMap((p) => p.assignments)
    .find((a) => a.familyId === "A" && a.forcedSplit);
  assert.ok(forced, "une attribution en fractionnement forcé doit exister");
  assert.equal(forced.score, 30);
  assert.equal(forced.weeks.length, 2);
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

test("contrainte 'impossible' + refus de split → aucune combinaison (secours)", () => {
  const result = generateSchedules(
    input({
      weekCount: 3,
      families: [
        // week1 impossible ; A refuse le split ; seul appariement possible {0,2}
        // est non contigu et non volontaire → invalide.
        {
          id: "A",
          rightWeeks: 2,
          acceptsSplit: false,
          prefs: { 0: "non_coche", 1: "impossible", 2: "non_coche" },
        },
      ],
    }),
  );

  assert.equal(result.status, "fallback");
  if (result.status !== "fallback") return;
  assert.equal(result.reason, "aucune_combinaison");
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
