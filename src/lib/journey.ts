import { prisma } from "@/lib/prisma";

/**
 * État d'avancement d'une famille dans le cycle courant, pour produire des
 * messages contextuels clairs sur les écrans (préférences, vote) quand il n'y a
 * rien à faire *ici* mais quelque chose à faire *ailleurs* — plutôt qu'un « rien
 * en cours » abrupt. La logique de message est isolée dans des fonctions pures
 * (testées) ; seule `getJourneyStage` touche la base.
 */

export type JourneyStage = {
  /** Statut du cycle actif (non clôturé) le plus récent, ou null. */
  activeStatut: string | null;
  activeAnnee: number | null;
  /** La famille a-t-elle soumis ses préférences (ou opt-out) dans ce cycle ? */
  responded: boolean;
  /** La famille a-t-elle voté ? */
  voted: boolean;
  /** Une décision finale existe-t-elle déjà pour le cycle actif ? */
  activeDecided: boolean;
  /** Année du dernier cycle décidé (actif décidé ou clôturé), sinon null. */
  decidedAnnee: number | null;
};

export type EmptyMessage = {
  title: string;
  description: string;
  cta: { href: string; label: string } | null;
};

export async function getJourneyStage(
  userId: string,
  propertyId: string,
): Promise<JourneyStage> {
  const [active, decided] = await Promise.all([
    prisma.cycle.findFirst({
      where: { propertyId, statut: { not: "cloture" } },
      orderBy: { annee: "desc" },
      select: {
        annee: true,
        statut: true,
        finalSchedule: { select: { id: true } },
        familyRights: { where: { userId }, select: { soumisLe: true } },
        optOuts: { where: { userId }, select: { id: true } },
        votes: { where: { userId }, select: { id: true } },
      },
    }),
    prisma.cycle.findFirst({
      where: { propertyId, finalSchedule: { isNot: null } },
      orderBy: { annee: "desc" },
      select: { annee: true },
    }),
  ]);

  return {
    activeStatut: active?.statut ?? null,
    activeAnnee: active?.annee ?? null,
    responded: active
      ? active.optOuts.length > 0 || active.familyRights[0]?.soumisLe != null
      : false,
    voted: active ? active.votes.length > 0 : false,
    activeDecided: active ? active.finalSchedule !== null : false,
    decidedAnnee: decided?.annee ?? null,
  };
}

/** Message de l'écran Préférences quand le formulaire n'est pas disponible. */
export function preferencesEmptyMessage(s: JourneyStage): EmptyMessage {
  const a = s.activeAnnee;
  switch (s.activeStatut) {
    case "config":
      return {
        title: `Cycle ${a} en préparation`,
        description:
          "La configuration est en cours. Vous serez notifié·e par e-mail dès l'ouverture de la collecte.",
        cta: null,
      };
    case "generation":
      return {
        title: `Génération en cours — ${a}`,
        description: "Les plannings sont en cours de calcul ; le vote ouvre très bientôt.",
        cta: null,
      };
    case "vote":
      if (s.activeDecided)
        return {
          title: `Planning ${a} arrêté`,
          description: "La répartition est confirmée.",
          cta: { href: "/vote", label: "Découvrir le planning" },
        };
      return {
        title: s.responded
          ? `Vos préférences pour ${a} sont transmises`
          : `La collecte ${a} est terminée`,
        description: "Place au vote : découvrez les plannings proposés.",
        cta: { href: "/vote", label: "Voter pour le planning" },
      };
    case "mediation":
      return {
        title: `Médiation en cours — ${a}`,
        description:
          "L'administrateur arbitre manuellement la répartition. Vous serez informé·e du planning retenu.",
        cta: { href: "/tableau-de-bord", label: "Voir mon espace" },
      };
    default:
      // Aucun cycle actif : soit un planning clôturé à consulter, soit rien.
      if (s.decidedAnnee)
        return {
          title: `Planning ${s.decidedAnnee} arrêté`,
          description: "La collecte est terminée. Vous pouvez consulter le planning retenu.",
          cta: { href: "/vote", label: "Découvrir le planning" },
        };
      return {
        title: "Aucune collecte en cours",
        description:
          "Vous serez notifié·e par e-mail dès l'ouverture de la prochaine collecte des préférences.",
        cta: null,
      };
  }
}

/** Message de l'écran Vote quand aucune proposition n'est ouverte au vote. */
export function voteEmptyMessage(s: JourneyStage): EmptyMessage {
  const a = s.activeAnnee;
  switch (s.activeStatut) {
    case "collecte":
    case "collecte_tour2":
      return {
        title: `Collecte en cours — ${a}`,
        description: s.responded
          ? "Vos préférences sont enregistrées. Le vote ouvrira une fois les plannings générés."
          : "Renseignez d'abord vos préférences ; le vote ouvrira ensuite.",
        cta: s.responded
          ? null
          : { href: "/preferences", label: "Saisir mes préférences" },
      };
    case "config":
      return {
        title: `Cycle ${a} en préparation`,
        description:
          "Le vote ouvrira une fois les préférences collectées et les plannings générés.",
        cta: null,
      };
    case "generation":
      return {
        title: `Génération en cours — ${a}`,
        description: "Les plannings sont en cours de calcul. Revenez dans un instant.",
        cta: null,
      };
    case "mediation":
      return {
        title: `Médiation en cours — ${a}`,
        description:
          "Aucun planning satisfaisant n'a été trouvé ; l'administrateur arbitre la répartition.",
        cta: { href: "/tableau-de-bord", label: "Voir mon espace" },
      };
    default:
      return {
        title: "Aucun planning à voter",
        description: "Aucune proposition n'est ouverte au vote pour le moment.",
        cta: null,
      };
  }
}
