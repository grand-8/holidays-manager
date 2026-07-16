/**
 * Types du domaine pour l'algorithme de génération des plannings (spec section 4.5).
 * Ces types sont volontairement indépendants de Prisma : l'algorithme est une
 * fonction pure, testable sans base de données. La couche applicative se charge
 * de convertir les entités Prisma vers/depuis ces structures.
 */

/** Statut d'une préférence d'une famille pour une semaine (spec section 4.2). */
export type PreferenceStatus =
  | "preferee"
  | "alternative"
  | "non_coche"
  | "impossible";

/** Une famille participant au tirage (les opt-out ne sont pas passés à l'algo). */
export type FamilyInput = {
  id: string;
  /** Droit annuel : 1 ou 2 semaines. */
  rightWeeks: 1 | 2;
  /**
   * Réponse explicite à « j'accepte que mes 2 semaines soient scindées si
   * nécessaire ». N'a de sens que pour rightWeeks === 2. Défaut protecteur : false.
   */
  acceptsSplit: boolean;
  /**
   * Statut de préférence par index de semaine. Les semaines absentes de la map
   * sont considérées « non_coche » (statut par défaut, spec section 4.2).
   */
  prefs: Record<number, PreferenceStatus>;
};

/**
 * Entrée de l'algorithme. Les semaines sont identifiées par leur `ordre`
 * (index 0..n-1, contigu et croissant : deux semaines sont adjacentes ssi leurs
 * ordres diffèrent de 1).
 */
export type GenerateInput = {
  /** Nombre de semaines de la période (ordres 0..weekCount-1). */
  weekCount: number;
  /** Familles non-opt-out uniquement. */
  families: FamilyInput[];
  /** Seuil de score minimum acceptable, en % (spec section 4.1, défaut 40). */
  seuilScoreMinimum: number;
  /** Délai maximal de calcul en ms (spec section 4.5, défaut 30000). */
  timeBudgetMs?: number;
};

/** Attribution d'une semaine à une famille au sein d'une combinaison. */
export type Assignment = {
  familyId: string;
  /** Ordres des semaines attribuées à cette famille (1 ou 2 éléments). */
  weeks: number[];
  /** Score individuel de la famille (0..100). */
  score: number;
  /** Vrai si fractionnement forcé non volontaire (score forfaitaire 30%). */
  forcedSplit: boolean;
};

/** Une combinaison complète notée (= une proposition candidate). */
export type ScoredCombination = {
  assignments: Assignment[];
  /** Moyenne des scores des familles participantes. */
  globalScore: number;
  /** Plus bas score individuel (indicateur d'équité). */
  minScore: number;
  /**
   * Vecteur des scores individuels trié croissant (pire → meilleur), pour le
   * départage leximin.
   */
  sortedScores: number[];
};

/** Raison d'un basculement en mode de secours (spec section 4.7). */
export type FallbackReason =
  | "aucune_combinaison" // aucune combinaison valide
  | "moins_de_deux" // une seule combinaison valide
  | "sous_seuil" // meilleur score minimum sous le seuil
  | "timeout"; // délai de calcul dépassé sans combinaison

/** Résultat de la génération : soit des propositions, soit un mode de secours. */
export type GenerateResult =
  | { status: "ok"; proposals: ScoredCombination[] }
  | { status: "fallback"; reason: FallbackReason };
