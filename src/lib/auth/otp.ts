import { randomInt, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { OTP_LENGTH } from "@/lib/constants";

/**
 * Génération et vérification des codes OTP (spec section 2).
 *
 * Le code est stocké HACHÉ en base (jamais en clair). Le hachage seul ne suffit
 * pas face à un million de possibilités : la vraie protection reste l'expiration
 * (10 min) et la limite de tentatives (5). On utilise malgré tout un hachage lent
 * (scrypt) avec sel aléatoire et poivre (SESSION_SECRET), comme pour un mot de passe.
 */

/** Génère un code numérique à 6 chiffres, avec zéros de tête possibles. */
export function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

/** Hache un code OTP : renvoie "sel:hash" (hex). */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(code + env.SESSION_SECRET, salt, 32);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Vérifie un code OTP contre un haché "sel:hash", en temps constant. */
export function verifyOtpCode(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(code + env.SESSION_SECRET, salt, 32);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
