/**
 * Découpage d'une période de location en semaines pleines (spec section 4.1).
 *
 * Une semaine va d'un « jour de bascule » (par défaut samedi) au même jour la
 * semaine suivante. Toute portion résiduelle (avant la première semaine pleine
 * ou après la dernière, de moins de 7 jours) est exclue du planning.
 *
 * Fonction pure : les dates sont manipulées en UTC (minuit) pour éviter tout
 * décalage de fuseau horaire.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ramène une date à minuit UTC (ignore l'heure). */
function atUtcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export type ComputedWeekSlot = {
  ordre: number;
  dateDebut: Date;
  dateFin: Date;
};

export type WeekComputation = {
  slots: ComputedWeekSlot[];
  /** Jours exclus avant la première semaine pleine (alignement du jour de bascule). */
  leadingResidualDays: number;
  /** Jours exclus après la dernière semaine pleine (spec : « non utilisable »). */
  trailingResidualDays: number;
};

/**
 * Découpe [dateDebut, dateFin] en semaines pleines commençant le jour de bascule.
 * @param jourBascule 0 = dimanche … 6 = samedi.
 */
export function computeWeekSlots(
  dateDebut: Date,
  dateFin: Date,
  jourBascule: number,
): WeekComputation {
  const start = atUtcMidnight(dateDebut);
  const end = atUtcMidnight(dateFin);

  if (end.getTime() <= start.getTime()) {
    return { slots: [], leadingResidualDays: 0, trailingResidualDays: 0 };
  }

  // Première occurrence du jour de bascule à partir du début (inclus).
  const offsetToFirst = (jourBascule - start.getUTCDay() + 7) % 7;
  const firstSlotStart = addDays(start, offsetToFirst);

  const slots: ComputedWeekSlot[] = [];
  let cursor = firstSlotStart;
  let ordre = 0;
  while (addDays(cursor, 7).getTime() <= end.getTime()) {
    slots.push({ ordre, dateDebut: cursor, dateFin: addDays(cursor, 7) });
    cursor = addDays(cursor, 7);
    ordre += 1;
  }

  // Résidu de début : jours entre le début et la première semaine pleine, mais
  // seulement s'il existe au moins une semaine (sinon toute la période est résiduelle).
  const leadingResidualDays =
    slots.length > 0
      ? Math.round((firstSlotStart.getTime() - start.getTime()) / DAY_MS)
      : 0;

  // Résidu de fin : jours restants après la dernière semaine pleine.
  const lastEnd = slots.length > 0 ? cursor : start;
  const trailingResidualDays = Math.max(
    0,
    Math.round((end.getTime() - lastEnd.getTime()) / DAY_MS),
  );

  return { slots, leadingResidualDays, trailingResidualDays };
}
