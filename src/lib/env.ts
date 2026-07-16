import { z } from "zod";

/**
 * Validation des variables d'environnement au démarrage (spec section 9).
 * Tous les secrets (Resend, Neon, secret de session) proviennent uniquement de
 * variables d'environnement — jamais committés dans le code source.
 */
const envSchema = z.object({
  // Base de données Neon (Postgres).
  DATABASE_URL: z.url(),
  // Connexion directe pour les migrations Prisma (Neon).
  DIRECT_URL: z.url(),

  // Resend : clé API + adresse d'envoi sur domaine vérifié.
  RESEND_API_KEY: z.string().min(1),
  // Peut contenir un nom d'affichage : « Nom <adresse@domaine> ». On valide souplement.
  RESEND_FROM_EMAIL: z.string().min(3),

  // Secret aléatoire pour signer/hacher les jetons de session.
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),

  // URL publique de l'application (pour construire les liens dans les emails).
  APP_URL: z.url(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement invalides ou manquantes :\n${issues}\n` +
        `Copiez .env.example vers .env.local et renseignez les valeurs.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
