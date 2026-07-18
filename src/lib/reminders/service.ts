import { prisma } from "@/lib/prisma";
import { getCompletion } from "@/lib/cycles/service";
import {
  sendPreferenceReminderEmail,
  sendVoteReminderEmail,
} from "@/lib/emails/reminders";

/**
 * Relances automatiques J-7 / J-3 (spec section 6, items 3 & 6). Conçu pour être
 * déclenché une fois par jour par Vercel Cron via /api/cron/reminders.
 *
 * La logique de fenêtre est isolée dans `reminderDue` (pure, testée) ; l'envoi
 * réel et les marqueurs anti-doublon vivent dans `runReminders`.
 */

const DAY_MS = 86_400_000;

export type ReminderMarkers = { j7Sent: boolean; j3Sent: boolean };

/**
 * Quelle relance doit partir maintenant, compte tenu de la deadline et des
 * relances déjà envoyées ? Robuste à un cron manqué : la relance J-7 part dès
 * qu'on entre dans la fenêtre des 7 jours (tant qu'il reste > 3 jours), la J-3
 * dans les 3 derniers jours. Chaque relance ne part qu'une fois (marqueurs).
 */
export function reminderDue(
  deadline: Date,
  now: Date,
  markers: ReminderMarkers,
): "j7" | "j3" | null {
  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) return null; // deadline atteinte : plus de relance.
  if (msLeft <= 3 * DAY_MS) return markers.j3Sent ? null : "j3";
  if (msLeft <= 7 * DAY_MS) return markers.j7Sent ? null : "j7";
  return null; // trop tôt.
}

export type ReminderSummary = {
  cyclesTraites: number;
  relancesPref: number;
  relancesVote: number;
  emailsEnvoyes: number;
};

/**
 * Parcourt les cycles en collecte (préférences) ou en vote, et envoie la
 * relance due aux familles concernées (n'ayant pas soumis / pas voté).
 */
export async function runReminders(
  now: Date = new Date(),
): Promise<ReminderSummary> {
  const cycles = await prisma.cycle.findMany({
    where: { statut: { in: ["collecte", "collecte_tour2", "vote"] } },
    select: {
      id: true,
      annee: true,
      propertyId: true,
      statut: true,
      deadlinePreferences: true,
      deadlineVote: true,
      relancePref7Le: true,
      relancePref3Le: true,
      relanceVote7Le: true,
      relanceVote3Le: true,
      // Une décision déjà prise (planning retenu) coupe court aux relances de
      // vote : la phase est terminée même si le cycle n'est pas encore clôturé.
      finalSchedule: { select: { id: true } },
      property: { select: { nom: true } },
    },
  });

  const summary: ReminderSummary = {
    cyclesTraites: cycles.length,
    relancesPref: 0,
    relancesVote: 0,
    emailsEnvoyes: 0,
  };

  for (const cycle of cycles) {
    const isVote = cycle.statut === "vote";
    // Décision déjà arrêtée pendant le vote (avant clôture) : plus de relance.
    if (isVote && cycle.finalSchedule) continue;
    const deadline = isVote ? cycle.deadlineVote : cycle.deadlinePreferences;
    if (!deadline) continue;

    const markers: ReminderMarkers = isVote
      ? { j7Sent: cycle.relanceVote7Le !== null, j3Sent: cycle.relanceVote3Le !== null }
      : { j7Sent: cycle.relancePref7Le !== null, j3Sent: cycle.relancePref3Le !== null };

    const due = reminderDue(deadline, now, markers);
    if (!due) continue;

    const recipients = isVote
      ? await pendingVoters(cycle.id, cycle.propertyId)
      : await pendingResponders(cycle.id, cycle.propertyId);

    // On envoie à chaque destinataire indépendamment (une famille en échec ne
    // bloque pas les autres), puis on marque la relance comme partie.
    const results = await Promise.allSettled(
      recipients.map((email) =>
        isVote
          ? sendVoteReminderEmail(email, cycle.annee, deadline, cycle.property.nom)
          : sendPreferenceReminderEmail(email, cycle.annee, deadline, cycle.property.nom),
      ),
    );
    summary.emailsEnvoyes += results.filter((r) => r.status === "fulfilled").length;

    const field = isVote
      ? due === "j7" ? "relanceVote7Le" : "relanceVote3Le"
      : due === "j7" ? "relancePref7Le" : "relancePref3Le";
    await prisma.cycle.update({ where: { id: cycle.id }, data: { [field]: now } });

    if (isVote) summary.relancesVote += 1;
    else summary.relancesPref += 1;
  }

  return summary;
}

/** Emails des familles actives n'ayant pas encore soumis leurs préférences. */
async function pendingResponders(
  cycleId: string,
  propertyId: string,
): Promise<string[]> {
  const rows = await getCompletion(cycleId, propertyId);
  const pendingIds = rows.filter((r) => !r.responded).map((r) => r.userId);
  if (pendingIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: pendingIds }, actif: true },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

/** Emails des familles actives n'ayant pas encore voté. */
async function pendingVoters(
  cycleId: string,
  propertyId: string,
): Promise<string[]> {
  const [users, votes] = await Promise.all([
    prisma.user.findMany({
      where: { propertyId, actif: true },
      select: { id: true, email: true },
    }),
    prisma.vote.findMany({ where: { cycleId }, select: { userId: true } }),
  ]);
  const voted = new Set(votes.map((v) => v.userId));
  return users.filter((u) => !voted.has(u.id)).map((u) => u.email);
}
