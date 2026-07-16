/**
 * Constantes de score, centralisées à un seul endroit (spec section 12).
 * Ne jamais dupliquer ces valeurs ailleurs dans le code : elles doivent rester
 * ajustables depuis ce fichier unique.
 */

/** Scores attribués selon le statut d'une préférence (spec section 4.2). */
export const SCORE = {
  /** Semaine « Préférée ». */
  PREFEREE: 100,
  /** Semaine « Alternative ». */
  ALTERNATIVE: 70,
  /** Semaine « Non cochée » (statut par défaut). */
  NON_COCHE: 40,
  /** Score forfaitaire d'une famille en cas de fractionnement forcé non volontaire. */
  FRACTIONNEMENT_FORCE: 30,
} as const;

/** Seuil de score minimum acceptable par défaut, en % (spec section 4.1). */
export const DEFAULT_SEUIL_SCORE_MINIMUM = 40;

/** Durée de vie d'un code OTP (spec section 2). */
export const OTP_TTL_MINUTES = 10;

/** Nombre maximal de tentatives de saisie d'un code OTP (spec section 2). */
export const OTP_MAX_ATTEMPTS = 5;

/** Anti-abus : nombre maximal de demandes de code par email et par fenêtre (spec section 2). */
export const OTP_REQUEST_MAX = 3;
export const OTP_REQUEST_WINDOW_MINUTES = 15;

/** Durée de vie glissante d'une session, en jours (spec section 2). */
export const SESSION_TTL_DAYS = 30;

/** Nom du cookie de session (module pur : importable côté edge/middleware). */
export const SESSION_COOKIE = "session";

/** Longueur du code OTP. */
export const OTP_LENGTH = 6;

/** Jour de bascule par défaut d'un bien : samedi (0 = dimanche … 6 = samedi). */
export const DEFAULT_JOUR_BASCULE = 6;
