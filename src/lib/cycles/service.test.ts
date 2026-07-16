import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCoherence } from "./service";

test("cohérence : somme des droits <= semaines disponibles → ok", () => {
  const r = checkCoherence(
    [{ nombreSemaines: 2 }, { nombreSemaines: 1 }, { nombreSemaines: 1 }],
    5,
  );
  assert.equal(r.totalRights, 4);
  assert.equal(r.weekCount, 5);
  assert.equal(r.ok, true);
});

test("cohérence : somme des droits > semaines → ko (spec section 4.1)", () => {
  const r = checkCoherence(
    [{ nombreSemaines: 2 }, { nombreSemaines: 2 }, { nombreSemaines: 2 }],
    5,
  );
  assert.equal(r.totalRights, 6);
  assert.equal(r.ok, false);
});

test("cohérence : égalité stricte → ok", () => {
  const r = checkCoherence([{ nombreSemaines: 2 }, { nombreSemaines: 3 }], 5);
  assert.equal(r.ok, true);
});
