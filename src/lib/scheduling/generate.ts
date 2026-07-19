/**
 * Algorithme de génération des propositions de planning (spec section 4.5).
 *
 * Fonction pure : aucune dépendance à la base de données. Étant donné la petite
 * taille du problème (quelques familles, quelques semaines), on énumère
 * exhaustivement les combinaisons valides par retour arrière (backtracking),
 * borné par un délai maximal.
 */
import { SCORE } from "@/lib/constants";
import type {
  Assignment,
  FamilyInput,
  GenerateInput,
  GenerateResult,
  PreferenceStatus,
  ScoredCombination,
} from "./types";

const DEFAULT_TIME_BUDGET_MS = 30_000;
const MIN_PROPOSALS = 2;
const MAX_PROPOSALS = 5;
/**
 * Nombre maximal de variantes conservées par « palier » de score identique
 * (même score individuel pour chaque famille, semaines différentes). Évite
 * qu'une vraie alternative à score égal soit purement et simplement effacée au
 * profit d'une option strictement moins bonne (spec section 4.5, étape 3).
 */
const MAX_PER_SCORE_PROFILE = 2;

/** Score d'une semaine selon son statut de préférence (spec section 4.2). */
function weekScore(status: PreferenceStatus): number {
  switch (status) {
    case "preferee":
      return SCORE.PREFEREE;
    case "alternative":
      return SCORE.ALTERNATIVE;
    case "non_coche":
      return SCORE.NON_COCHE;
    case "impossible":
      // Ne devrait jamais être attribuée ; garde-fou.
      return 0;
  }
}

/** Statut d'une famille pour une semaine (défaut « non_coche »). */
function statusOf(family: FamilyInput, week: number): PreferenceStatus {
  return family.prefs[week] ?? "non_coche";
}

/** Deux semaines sont adjacentes ssi leurs ordres diffèrent de 1. */
function isContiguous(weeks: number[]): boolean {
  if (weeks.length < 2) return true;
  const sorted = [...weeks].sort((a, b) => a - b);
  return sorted[1] - sorted[0] === 1;
}

/**
 * Appariements de 2 semaines valides pour une famille, parmi les semaines
 * `usable` (déjà filtrées des « impossible »).
 *
 * Contrainte (spec section 4.5, étape 1c) : un bloc contigu est toujours
 * autorisé ; un fractionnement (2 semaines non consécutives) l'est seulement si
 * la famille l'accepte, ou s'il est volontaire (les deux semaines « préférée »).
 */
function pairOptions(family: FamilyInput, usable: number[]): number[][] {
  const options: number[][] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const pair = [usable[i], usable[j]];
      const contiguous = isContiguous(pair);
      const bothPreferred =
        statusOf(family, pair[0]) === "preferee" &&
        statusOf(family, pair[1]) === "preferee";
      if (contiguous || family.acceptsSplit || bothPreferred) {
        options.push(pair);
      }
    }
  }
  return options;
}

/**
 * Une famille ayant droit à 2 semaines peut-elle réellement en obtenir 2, compte
 * tenu de SES seules contraintes (semaines « impossible », refus de scinder) —
 * indépendamment de la concurrence des autres familles (spec section 4.2) ?
 *
 * Sert (1) à l'algorithme, qui rétrograde à 1 semaine une famille sans aucun
 * appariement valide au lieu de basculer tout le cycle en secours, et (2) au
 * formulaire de préférences, qui demande alors confirmation à la famille.
 */
export function canTakeTwoWeeks(family: FamilyInput, weekCount: number): boolean {
  if (family.rightWeeks !== 2) return false;
  const usable = Array.from({ length: weekCount }, (_, i) => i).filter(
    (w) => statusOf(family, w) !== "impossible",
  );
  return pairOptions(family, usable).length > 0;
}

/**
 * Énumère toutes les attributions de semaines valides pour UNE famille prise
 * isolément, parmi les semaines encore disponibles, pour le nombre de semaines
 * effectivement visé (1 ou 2 ; une famille à 2 semaines sans appariement possible
 * est ramenée à 1, spec section 4.2).
 *
 * Contrainte (b) : aucune semaine « impossible » ne lui est attribuée.
 */
function familyOptions(
  family: FamilyInput,
  available: number[],
  weeksWanted: 1 | 2,
): number[][] {
  const usable = available.filter(
    (w) => statusOf(family, w) !== "impossible",
  );

  if (weeksWanted === 1) {
    return usable.map((w) => [w]);
  }
  return pairOptions(family, usable);
}

/**
 * Calcule le score individuel d'une famille pour les semaines attribuées.
 * Exporté pour la médiation (§4.7.2), qui note une attribution manuelle avec les
 * mêmes règles que l'algorithme (fractionnement forcé → 30 %).
 */
export function scoreFamily(
  family: FamilyInput,
  weeks: number[],
): { score: number; forcedSplit: boolean } {
  const split = weeks.length === 2 && !isContiguous(weeks);
  const bothPreferred =
    weeks.length === 2 &&
    weeks.every((w) => statusOf(family, w) === "preferee");
  // Fractionnement « forcé non volontaire » : scindé sans avoir été explicitement
  // demandé (les deux semaines ne sont pas toutes deux « préférée ») → 30% forfait.
  const forcedSplit = split && !bothPreferred;

  if (forcedSplit) {
    return { score: SCORE.FRACTIONNEMENT_FORCE, forcedSplit: true };
  }

  const avg =
    weeks.reduce((sum, w) => sum + weekScore(statusOf(family, w)), 0) /
    weeks.length;
  return { score: avg, forcedSplit: false };
}

/** Assemble une combinaison notée à partir d'attributions par famille. */
function scoreCombination(assignments: Assignment[]): ScoredCombination {
  const scores = assignments.map((a) => a.score);
  const globalScore =
    scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const minScore = sortedScores[0] ?? 0;
  return { assignments, globalScore, minScore, sortedScores };
}

/**
 * Départage leximin (spec section 4.5) : compare les vecteurs de scores triés du
 * pire au meilleur, position par position. Retourne un nombre < 0 si `a` doit
 * être classée avant `b` (a est meilleure), > 0 sinon, 0 si strictement égales.
 */
export function compareLeximin(
  a: ScoredCombination,
  b: ScoredCombination,
): number {
  // Score global décroissant d'abord.
  if (a.globalScore !== b.globalScore) {
    return b.globalScore - a.globalScore;
  }
  // Égalité de score global → leximin sur les scores triés croissant.
  const len = Math.min(a.sortedScores.length, b.sortedScores.length);
  for (let i = 0; i < len; i++) {
    if (a.sortedScores[i] !== b.sortedScores[i]) {
      return b.sortedScores[i] - a.sortedScores[i];
    }
  }
  return 0;
}

/**
 * Deux combinaisons ont un profil de scores identique (famille par famille) —
 * même si les semaines concrètement attribuées diffèrent. Sert à regrouper les
 * combinaisons en « paliers » pour la sélection (voir `MAX_PER_SCORE_PROFILE`).
 */
function sameScoreProfile(
  a: ScoredCombination,
  b: ScoredCombination,
): boolean {
  const byFamily = (c: ScoredCombination) =>
    new Map(c.assignments.map((x) => [x.familyId, x.score]));
  const ma = byFamily(a);
  const mb = byFamily(b);
  if (ma.size !== mb.size) return false;
  for (const [id, score] of ma) {
    if (mb.get(id) !== score) return false;
  }
  return true;
}

/**
 * Énumère toutes les combinaisons valides par backtracking, borné par le délai.
 * Retourne la liste des combinaisons notées, et un drapeau `timedOut`.
 */
function enumerateCombinations(
  input: GenerateInput,
): { combinations: ScoredCombination[]; timedOut: boolean } {
  const { families, weekCount } = input;
  const budget = input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const deadline = Date.now() + budget;

  const allWeeks = Array.from({ length: weekCount }, (_, i) => i);
  const combinations: ScoredCombination[] = [];
  let timedOut = false;

  // Pré-calcul des options par famille (indépendantes de l'ordre d'affectation
  // sauf pour la disponibilité, filtrée à la volée pendant le backtracking).
  const order = [...families];

  // Nombre de semaines effectivement visé par famille : une famille à 2 semaines
  // dont les contraintes propres interdisent tout appariement est ramenée à 1
  // (spec section 4.2) plutôt que de faire échouer tout le cycle.
  const weeksWanted = new Map<string, 1 | 2>(
    families.map((f) => [f.id, canTakeTwoWeeks(f, weekCount) ? 2 : 1]),
  );

  const used = new Set<number>();
  const current: Assignment[] = [];

  function backtrack(idx: number) {
    if (timedOut) return;
    if (Date.now() > deadline) {
      timedOut = true;
      return;
    }
    if (idx === order.length) {
      combinations.push(scoreCombination(current.map((a) => ({ ...a }))));
      return;
    }
    const family = order[idx];
    const available = allWeeks.filter((w) => !used.has(w));
    const options = familyOptions(family, available, weeksWanted.get(family.id)!);

    for (const weeks of options) {
      if (timedOut) return;
      const { score, forcedSplit } = scoreFamily(family, weeks);
      weeks.forEach((w) => used.add(w));
      current.push({ familyId: family.id, weeks, score, forcedSplit });

      backtrack(idx + 1);

      current.pop();
      weeks.forEach((w) => used.delete(w));
    }
  }

  backtrack(0);
  return { combinations, timedOut };
}

/**
 * Sélectionne entre 2 et 5 propositions à présenter (spec section 4.5, étape 3),
 * ou signale un basculement en mode de secours.
 */
function selectProposals(
  combinations: ScoredCombination[],
  seuilScoreMinimum: number,
): GenerateResult {
  if (combinations.length === 0) {
    return { status: "fallback", reason: "aucune_combinaison" };
  }

  // Classement par score global décroissant, départagé par leximin.
  const ranked = [...combinations].sort(compareLeximin);

  // Meilleur score minimum atteignable sur l'ensemble des combinaisons.
  const bestMin = Math.max(...combinations.map((c) => c.minScore));
  if (bestMin < seuilScoreMinimum) {
    return { status: "fallback", reason: "sous_seuil" };
  }

  // Sélection par palier de score : jusqu'à `MAX_PER_SCORE_PROFILE` variantes
  // (semaines différentes, même score par famille) sont conservées avant de
  // descendre au palier de score suivant. Empêche qu'une vraie alternative à
  // score égal soit remplacée par une option strictement moins bonne juste
  // parce qu'une autre variante du même palier avait déjà été retenue.
  const selected: ScoredCombination[] = [];
  const selectedSet = new Set<ScoredCombination>();
  const tryAdd = (candidate: ScoredCombination): boolean => {
    if (selectedSet.has(candidate)) return false; // déjà retenue (même combinaison).
    const tierCount = selected.filter((s) => sameScoreProfile(s, candidate)).length;
    if (tierCount >= MAX_PER_SCORE_PROFILE) return false; // palier déjà plein.
    selected.push(candidate);
    selectedSet.add(candidate);
    return true;
  };

  // 1) Le meilleur score global (leximin en cas d'égalité).
  tryAdd(ranked[0]);

  // 2) L'option la plus équitable (meilleur score minimum), si différente.
  const mostEquitable = [...ranked].sort((a, b) => {
    if (a.minScore !== b.minScore) return b.minScore - a.minScore;
    return compareLeximin(a, b);
  })[0];
  tryAdd(mostEquitable);

  // 3) Compléter avec les meilleurs scores globaux suivants, palier par palier.
  for (const candidate of ranked) {
    if (selected.length >= MAX_PROPOSALS) break;
    tryAdd(candidate);
  }

  if (selected.length < MIN_PROPOSALS) {
    return { status: "fallback", reason: "moins_de_deux" };
  }

  // Ordonner le résultat final par score global décroissant (leximin).
  selected.sort(compareLeximin);
  return { status: "ok", proposals: selected };
}

/**
 * Meilleure combinaison valide (classement leximin), ou null si aucune n'existe.
 * Utilisée par le mode de secours (§4.7) pour identifier les familles dont le
 * score serait sous le seuil et qui doivent être reciblées au second tour.
 */
export function bestCombination(input: GenerateInput): ScoredCombination | null {
  if (input.families.length === 0) return null;
  const { combinations } = enumerateCombinations(input);
  if (combinations.length === 0) return null;
  return [...combinations].sort(compareLeximin)[0];
}

/**
 * Point d'entrée : génère les propositions de planning à partir des préférences.
 * Les familles en opt-out ne doivent PAS figurer dans `input.families`.
 */
export function generateSchedules(input: GenerateInput): GenerateResult {
  // Cas limite : aucune famille active (toutes en opt-out) — géré en amont par
  // l'appelant (spec section 4.2), mais on reste défensif.
  if (input.families.length === 0) {
    return { status: "fallback", reason: "aucune_combinaison" };
  }

  const { combinations, timedOut } = enumerateCombinations(input);

  if (combinations.length === 0) {
    return {
      status: "fallback",
      reason: timedOut ? "timeout" : "aucune_combinaison",
    };
  }

  return selectProposals(combinations, input.seuilScoreMinimum);
}
