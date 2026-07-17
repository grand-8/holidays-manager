import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderDue, type ReminderMarkers } from "./service";

const NONE: ReminderMarkers = { j7Sent: false, j3Sent: false };
const DAY = 86_400_000;
const deadline = new Date("2026-08-01T08:00:00.000Z");
const at = (offsetMs: number) => new Date(deadline.getTime() - offsetMs);

test("ne relance pas trop tôt (> 7 jours avant)", () => {
  assert.equal(reminderDue(deadline, at(8 * DAY), NONE), null);
});

test("déclenche J-7 dès l'entrée dans la fenêtre des 7 jours", () => {
  assert.equal(reminderDue(deadline, at(7 * DAY), NONE), "j7");
  assert.equal(reminderDue(deadline, at(5 * DAY), NONE), "j7");
});

test("ne renvoie pas J-7 s'il est déjà parti", () => {
  assert.equal(reminderDue(deadline, at(5 * DAY), { j7Sent: true, j3Sent: false }), null);
});

test("déclenche J-3 dans les 3 derniers jours", () => {
  assert.equal(reminderDue(deadline, at(3 * DAY), NONE), "j3");
  assert.equal(reminderDue(deadline, at(1 * DAY), NONE), "j3");
});

test("ne renvoie pas J-3 s'il est déjà parti", () => {
  assert.equal(reminderDue(deadline, at(1 * DAY), { j7Sent: true, j3Sent: true }), null);
});

test("passe directement à J-3 si la fenêtre J-7 a été manquée", () => {
  // Cron manqué entre J-7 et J-3 : J-7 jamais envoyé, mais on est déjà à J-2.
  assert.equal(reminderDue(deadline, at(2 * DAY), NONE), "j3");
});

test("ne relance plus une fois la deadline atteinte ou dépassée", () => {
  assert.equal(reminderDue(deadline, at(0), NONE), null);
  assert.equal(reminderDue(deadline, at(-DAY), NONE), null);
});
