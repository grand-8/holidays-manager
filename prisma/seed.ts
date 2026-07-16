/**
 * Script d'initialisation (spec section 2 & 11).
 * Crée le bien et les comptes familles au déploiement — il n'existe aucune
 * inscription publique.
 *
 * Utilisation :
 *   1. cp prisma/families.example.json prisma/families.json
 *   2. Renseignez les familles réelles (nom, email, qui est admin) dans ce fichier.
 *   3. npm run db:seed
 *
 * Le script est idempotent : relancé, il met à jour les comptes existants
 * (repérés par email) sans créer de doublons, et n'écrase jamais un bien déjà
 * présent. Au moins une famille doit avoir isAdmin=true (spec section 2).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedFamily = {
  nomAffiche: string;
  email: string;
  isAdmin?: boolean;
};

type SeedData = {
  property: { nom: string; jourBascule?: number };
  families: SeedFamily[];
};

function loadSeedData(): SeedData {
  const path = join(process.cwd(), "prisma", "families.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `Fichier introuvable : ${path}\n` +
        `Copiez prisma/families.example.json vers prisma/families.json puis renseignez les familles réelles.`,
    );
  }
  const data = JSON.parse(raw) as SeedData;

  if (!data.property?.nom) {
    throw new Error("Le champ property.nom est requis.");
  }
  if (!Array.isArray(data.families) || data.families.length === 0) {
    throw new Error("Au moins une famille doit être définie.");
  }
  if (!data.families.some((f) => f.isAdmin)) {
    throw new Error(
      "Au moins une famille doit être admin (isAdmin: true) — spec section 2.",
    );
  }
  const emails = data.families.map((f) => f.email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    throw new Error("Les adresses email des familles doivent être uniques.");
  }
  return data;
}

async function main() {
  const data = loadSeedData();

  // Un seul bien pour l'instant : on réutilise le premier existant, sinon on le crée.
  const existingProperty = await prisma.property.findFirst();
  const property =
    existingProperty ??
    (await prisma.property.create({
      data: {
        nom: data.property.nom,
        jourBascule: data.property.jourBascule ?? 6,
      },
    }));

  for (const fam of data.families) {
    const email = fam.email.toLowerCase().trim();
    await prisma.user.upsert({
      where: { email },
      update: {
        nomAffiche: fam.nomAffiche,
        isAdmin: fam.isAdmin ?? false,
      },
      create: {
        email,
        nomAffiche: fam.nomAffiche,
        isAdmin: fam.isAdmin ?? false,
        propertyId: property.id,
      },
    });
    console.log(`✔ ${fam.nomAffiche} <${email}>${fam.isAdmin ? " (admin)" : ""}`);
  }

  console.log(`\nBien « ${property.nom} » initialisé avec ${data.families.length} famille(s).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
