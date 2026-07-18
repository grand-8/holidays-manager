import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preferencesEmptyMessage,
  voteEmptyMessage,
  type JourneyStage,
} from "./journey";

function stage(over: Partial<JourneyStage>): JourneyStage {
  return {
    activeStatut: null,
    activeAnnee: null,
    responded: false,
    voted: false,
    activeDecided: false,
    decidedAnnee: null,
    ...over,
  };
}

test("préférences — vote en cours, préférences transmises → CTA vers le vote", () => {
  const m = preferencesEmptyMessage(
    stage({ activeStatut: "vote", activeAnnee: 2026, responded: true }),
  );
  assert.match(m.title, /2026/);
  assert.match(m.title, /transmises/i);
  assert.equal(m.cta?.href, "/vote");
});

test("préférences — vote décidé → CTA découvrir le planning", () => {
  const m = preferencesEmptyMessage(
    stage({ activeStatut: "vote", activeAnnee: 2026, activeDecided: true }),
  );
  assert.match(m.title, /arrêté/i);
  assert.equal(m.cta?.href, "/vote");
});

test("préférences — cycle clôturé → propose de consulter le planning", () => {
  const m = preferencesEmptyMessage(stage({ decidedAnnee: 2025 }));
  assert.match(m.title, /2025/);
  assert.equal(m.cta?.href, "/vote");
});

test("préférences — rien du tout → pas de CTA", () => {
  const m = preferencesEmptyMessage(stage({}));
  assert.equal(m.cta, null);
});

test("vote — collecte en cours, pas répondu → CTA saisir préférences", () => {
  const m = voteEmptyMessage(
    stage({ activeStatut: "collecte", activeAnnee: 2026, responded: false }),
  );
  assert.equal(m.cta?.href, "/preferences");
});

test("vote — collecte en cours, déjà répondu → pas de CTA (attendre)", () => {
  const m = voteEmptyMessage(
    stage({ activeStatut: "collecte", activeAnnee: 2026, responded: true }),
  );
  assert.equal(m.cta, null);
});

test("vote — médiation → CTA vers l'espace", () => {
  const m = voteEmptyMessage(stage({ activeStatut: "mediation", activeAnnee: 2026 }));
  assert.equal(m.cta?.href, "/tableau-de-bord");
});
