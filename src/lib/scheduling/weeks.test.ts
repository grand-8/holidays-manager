import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeekSlots } from "./weeks";

const DAY_MS = 24 * 60 * 60 * 1000;
const SAMEDI = 6;

/** Avance une date jusqu'au prochain jour de semaine `dow` (inclus). */
function rollTo(from: Date, dow: number): Date {
  const d = new Date(from);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

test("période alignée de 5 semaines pleines → 5 slots, aucun résidu", () => {
  const debut = rollTo(new Date(Date.UTC(2026, 5, 1)), SAMEDI);
  const fin = addDays(debut, 35); // 5 semaines
  const { slots, leadingResidualDays, trailingResidualDays } = computeWeekSlots(
    debut,
    fin,
    SAMEDI,
  );
  assert.equal(slots.length, 5);
  assert.equal(leadingResidualDays, 0);
  assert.equal(trailingResidualDays, 0);
});

test("invariants : chaque slot commence au jour de bascule, dure 7 jours, contigu", () => {
  const debut = rollTo(new Date(Date.UTC(2026, 5, 1)), SAMEDI);
  const fin = addDays(debut, 35);
  const { slots } = computeWeekSlots(debut, fin, SAMEDI);
  for (let i = 0; i < slots.length; i++) {
    assert.equal(slots[i].dateDebut.getUTCDay(), SAMEDI);
    assert.equal(
      slots[i].dateFin.getTime() - slots[i].dateDebut.getTime(),
      7 * DAY_MS,
    );
    assert.equal(slots[i].ordre, i);
    if (i > 0) {
      // contiguïté : fin de la précédente = début de la suivante.
      assert.equal(
        slots[i].dateDebut.getTime(),
        slots[i - 1].dateFin.getTime(),
      );
    }
  }
});

test("début non aligné → résidu de tête, résidu de fin < 7", () => {
  const samedi = rollTo(new Date(Date.UTC(2026, 5, 1)), SAMEDI);
  const debut = addDays(samedi, -3); // 3 jours avant un samedi (mercredi)
  const fin = addDays(samedi, 7 * 3 + 2); // 3 semaines pleines + 2 jours
  const { slots, leadingResidualDays, trailingResidualDays } = computeWeekSlots(
    debut,
    fin,
    SAMEDI,
  );
  assert.equal(slots.length, 3);
  assert.equal(leadingResidualDays, 3);
  assert.equal(trailingResidualDays, 2);
  assert.equal(slots[0].dateDebut.getTime(), samedi.getTime());
});

test("période plus courte qu'une semaine → aucun slot", () => {
  const debut = rollTo(new Date(Date.UTC(2026, 5, 1)), SAMEDI);
  const fin = addDays(debut, 4);
  const { slots } = computeWeekSlots(debut, fin, SAMEDI);
  assert.equal(slots.length, 0);
});

test("jour de bascule configurable (dimanche = 0)", () => {
  const dimanche = rollTo(new Date(Date.UTC(2026, 5, 1)), 0);
  const fin = addDays(dimanche, 14);
  const { slots } = computeWeekSlots(dimanche, fin, 0);
  assert.equal(slots.length, 2);
  assert.equal(slots[0].dateDebut.getUTCDay(), 0);
});
