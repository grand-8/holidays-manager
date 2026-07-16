# Spécification fonctionnelle et technique
## Application de planification des vacances familiales partagées

---

## 1. Contexte et objectif

Une résidence familiale est partagée par plusieurs familles (typiquement 4, jusqu'à 8). Chaque année, durant une période définie (ex. l'été), chaque famille dispose d'un droit de location d'une ou deux semaines. L'application doit :

1. Collecter les préférences de vacances de chaque famille pour l'année en cours.
2. Générer automatiquement des propositions de planning optimisées selon ces préférences, avec un score de satisfaction objectif et transparent.
3. Permettre aux familles de voter sur les propositions et à l'administrateur d'arbitrer les cas de blocage.
4. Conserver un historique pluriannuel utilisé comme aide à la décision pour l'attribution des droits futurs.

Public cible : usage privé, un petit nombre de familles qui se connaissent entre elles. L'application doit rester **simple, transparente et prévisible** — pas de fonctionnalités superflues.

---

## 2. Rôles et comptes utilisateurs

- **Un compte = une famille = une adresse email unique.** Pas de multi-email par famille.
- **Rôle admin** : un compte peut cumuler le rôle admin ET participer normalement au tirage de vacances comme n'importe quelle famille.
- Il doit toujours exister **au moins un compte admin** ; le système doit empêcher de retirer le droit admin au dernier admin restant.
- Les droits admin sont modifiables à tout moment par un autre admin.
- **Authentification sans mot de passe** :
  - L'utilisateur saisit son email, reçoit un code OTP à 6 chiffres par email.
  - Le code est valable **10 minutes**, **5 tentatives maximum**, au-delà renvoi obligatoire d'un nouveau code.
  - Une fois validé, une session est maintenue via cookie sécurisé (httpOnly, secure, sameSite=strict), avec une durée de vie glissante de 30 jours (renouvelée à chaque visite).
  - **Protection anti-abus** : maximum 3 demandes de code par adresse email par tranche de 15 minutes. Si l'email saisi ne correspond à aucun compte, aucune erreur n'est affichée (même comportement visible que pour un email valide) — évite de révéler quelles adresses sont enregistrées.
  - Le code OTP est stocké **haché** en base (jamais en clair), comme un mot de passe le serait — utile surtout contre une consultation superficielle de la base (logs, requêtes de debug) : un code à 6 chiffres ne représente qu'un million de possibilités, donc le hachage seul ne suffirait pas face à un accès complet à la base. La vraie protection contre la force brute reste l'expiration à 10 minutes et la limite de 5 tentatives. Toute nouvelle demande de code invalide immédiatement les codes précédemment émis pour ce compte, pour qu'il n'y ait jamais plusieurs codes valides simultanément.
  - Une fonction de **déconnexion explicite** invalide la session côté serveur (pas seulement la suppression du cookie côté client).
  - **Risque accepté et assumé** : l'absence de mot de passe signifie que la sécurité du compte dépend entièrement de celle de la boîte email de la famille — un choix cohérent avec un usage privé entre familles qui se connaissent, mais qui serait inadapté à un contexte moins fermé.
- **Aucune inscription publique** : les comptes (familles et admin initial) sont créés uniquement via un script d'initialisation en base de données au déploiement, ou par un admin déjà existant depuis l'écran de gestion des utilisateurs (section 8).
- **Contrôle d'accès côté serveur** : toute vérification de droit (une famille ne peut lire/modifier que ses propres préférences, votes et intérêts pour une semaine ; seules les actions admin sont réservées à `isAdmin=true`) doit être appliquée côté serveur pour chaque requête, indépendamment de ce que l'interface affiche ou masque — l'interface n'est qu'un confort visuel, jamais une barrière de sécurité.

---

## 3. Le "bien" (Property)

Le modèle de données inclut une entité **Bien** dès le départ, même si une seule instance existe actuellement, pour permettre l'ajout futur d'un second bien sans refonte de schéma.

- Un Bien a : un nom, un **jour de bascule** (jour de la semaine servant de frontière entre deux semaines de location, par défaut samedi — configurable pour permettre un futur bien avec un autre jour de rotation), une liste de familles associées, un historique de cycles annuels.
- Toutes les autres entités (cycles, droits, préférences, plannings, historique) sont rattachées à un Bien.
- **Un seul cycle peut être actif à la fois pour un bien donné** (tout statut différent de `clôturé`) — évite la confusion de deux cycles qui se chevauchent pour la même période.

---

## 4. Cycle annuel — vue d'ensemble

```
Configuration (admin) 
   → Collecte des préférences (familles) 
      → Suivi de complétion 
         → Génération des propositions (déclenchement manuel admin) 
            → Vote des familles 
               → Décision finale 
                  → [si blocage : mode de secours en cascade]
                     → Clôture et archivage dans l'historique
```

### 4.1 Configuration annuelle (admin, typiquement au printemps)

L'admin définit, pour l'année :

- **Période louable** : date de début et de fin. Le système la découpe automatiquement en semaines pleines de **samedi à samedi**. Toute portion résiduelle en fin de période (moins d'une semaine complète) est exclue du planning et affichée à l'admin comme "non utilisable".
- **Transition entre semaines** : le jour de bascule (samedi) est un jour de croisement standard entre deux familles — pas de jour tampon nécessaire.
- **Droit annuel de chaque famille** : 1 ou 2 semaines.
  - Aide à la décision : le système affiche, à titre indicatif uniquement, un indicateur basé sur l'historique des 5 dernières années (nombre de fois où chaque famille a eu 2 semaines, ancienneté de la dernière occurrence). L'admin reste totalement libre de son choix final (une famille peut par exemple ne pas vouloir de 2 semaines cette année-là). Si aucun historique n'est disponible — ni importé (section 5.1), ni issu d'un cycle précédent —, cet indicateur affiche simplement "aucune donnée disponible" pour chaque famille.
- **Validation de cohérence** : le système empêche la validation de la configuration si la somme des semaines de droit attribuées dépasse le nombre de semaines disponibles dans la période. Une alerte explicite est affichée (ex. "6 semaines de droits attribuées pour 5 semaines disponibles").
- **Date limite de réponse** (deadline préférences), configurable.
- **Date limite de vote** (deadline vote), configurable.
- **Seuil de score minimum acceptable**, configurable, valeur par défaut **40%** (utilisé par le mode de secours, section 4.7).

Une fois la configuration validée, un email est envoyé automatiquement à toutes les familles du bien avec un lien vers le formulaire de préférences. **À partir de cet envoi, la période et le découpage en semaines sont définitivement verrouillés pour ce cycle** ; toute modification ultérieure de ces éléments nécessite un redémarrage complet du cycle (section 4.7, niveau 3).

### 4.2 Saisie des préférences (famille)

Pour chaque semaine de la période, la famille choisit un statut :

| Statut | Score si attribué |
|---|---|
| **Préférée** | 100% |
| **Alternative** | 70% |
| **Non coché** (statut par défaut si la famille ne touche pas à cette semaine) | 40% |
| **Impossible** | Contrainte dure — cette semaine ne sera **jamais** attribuée à cette famille, quelle que soit la situation |

Règles :
- Aucune limite sur le nombre de semaines marquées "Préférée" ou "Alternative" — la famille peut en marquer autant qu'elle veut ; le score ne dépend que de la semaine effectivement attribuée.
- **Familles avec 2 semaines de droit** : avant de pouvoir soumettre ses préférences, la famille doit répondre explicitement, sans valeur par défaut, à la question "J'accepte que mes 2 semaines soient scindées si nécessaire" (Oui / Non).
  - Si la famille marque elle-même deux semaines non consécutives comme "Préférée", cela vaut demande volontaire de fractionnement : chaque semaine est notée normalement (pas de pénalité).
  - Si l'algorithme est contraint d'attribuer deux semaines non consécutives à une famille qui n'a pas explicitement demandé ce découpage, le score de cette famille pour ce cycle est fixé **forfaitairement à 30%**, quel que soit le score individuel des deux semaines obtenues.
  - Si la famille a répondu "Non", l'algorithme ne peut jamais lui attribuer un fractionnement forcé (seulement un bloc contigu, ou rien du tout dans le pire cas — ce qui déclenche alors le mode de secours).
  - Si la famille n'a jamais explicitement validé cette case avant la deadline — qu'elle n'ait rien soumis du tout, ou seulement enregistré un brouillon partiel sans être allée jusqu'au bout — cette case est considérée par défaut comme "Non" — l'option la plus protectrice, puisque la famille n'a jamais confirmé son accord.
- **Non-participation** : bouton dédié "Je ne prends pas de vacances cette année", distinct de toute autre saisie et désactivant/masquant le reste du formulaire (grille des semaines et case fractionnement) puisqu'ils n'ont plus d'objet. Une famille en opt-out :
  - N'a aucune semaine attribuée dans les propositions de planning.
  - N'entre pas dans le calcul du score global ni du score minimum du planning.
  - Est comptée comme "a répondu ✅" dans le suivi de complétion.
  - Peut malgré tout manifester son intérêt pour une semaine non réclamée (section 4.9) — l'opt-out signifie seulement "ne pas me faire entrer dans l'algorithme principal", pas une exclusion totale de tout accès à la maison cette année-là.
- **Réponse après la deadline** : les semaines non renseignées restent au statut par défaut "non coché" (40%), comme si la famille les avait laissées telles quelles. L'admin est notifié des familles n'ayant pas répondu à temps et peut, au choix, prolonger le délai pour cette famille ou lancer la génération malgré tout.
- **Cas extrême — toutes les familles en opt-out** : si aucune famille active ne demande de semaine, la génération (section 4.5) est sautée et l'ensemble des semaines de la période bascule directement en "semaines non réclamées" (section 4.9).
- **Modification** : librement autorisée tant que le statut du cycle est "collecte en cours". Verrouillée dès le déclenchement de la génération (section 4.3), sauf réouverture complète du cycle par l'admin (section 4.7, niveau 3).
- **Relances automatiques** par email à J-7 et J-3 avant la deadline, envoyées uniquement aux familles n'ayant pas encore soumis.

### 4.3 Suivi de complétion

Toutes les familles (pas seulement l'admin) peuvent voir, pour le cycle en cours, la liste des familles avec leur statut : **répondu ✅** / **en attente ⏳**. Le détail des préférences de chaque famille n'est jamais visible avant la génération des propositions — ni aux autres familles, ni même partiellement.

### 4.4 Déclenchement de la génération (admin)

- Dès que toutes les familles ont répondu (ou que la deadline est dépassée), l'admin reçoit une notification (email + indicateur dans l'interface) l'invitant à lancer la génération.
- La génération est déclenchée **manuellement** par l'admin via un bouton "Générer les plannings" — jamais automatique. Ce point de contrôle permet à l'admin de vérifier une dernière fois les droits attribués avant calcul.
- Cette action **gèle définitivement** les droits annuels et les préférences pour ce cycle : plus aucune modification n'est possible ensuite, sauf réouverture complète du cycle (section 4.7).

### 4.5 Algorithme de génération des propositions

**Étape 1 — Génération des combinaisons valides.** Une combinaison est une attribution complète des semaines de la période aux familles, valide si et seulement si :
- (a) Chaque famille non-opt-out reçoit exactement son nombre de semaines de droit.
- (b) Aucune semaine marquée "Impossible" par une famille ne lui est attribuée.
- (c) Un fractionnement (semaines non consécutives) pour une famille à 2 semaines n'est possible que si elle a coché "j'accepte le fractionnement", ou si les deux semaines assignées correspondent exactement à des semaines qu'elle a elle-même marquées "Préférée".

Étant donné la taille réduite du problème (quelques familles, quelques semaines), une énumération exhaustive avec retour arrière (backtracking) est suffisante — aucun solveur de contraintes externe n'est nécessaire. Par sécurité, le calcul est borné par un délai maximal (ex. 30 secondes) ; si cette limite est atteinte sans qu'aucune combinaison n'ait été trouvée, la situation est traitée comme "aucune combinaison valide" et bascule sur le mode de secours (section 4.7).

**Étape 2 — Notation de chaque combinaison valide.**
- Score d'une famille = moyenne des scores des semaines qui lui sont attribuées, **sauf** en cas de fractionnement forcé non volontaire, où le score de la famille est fixé forfaitairement à 30% (remplace le calcul de moyenne).
- Score global du planning = moyenne des scores de toutes les familles participantes (hors opt-out).
- Score minimum du planning = le plus bas des scores individuels des familles (indicateur d'équité).

**Classement et départage (leximin).** Les combinaisons valides sont classées par score global décroissant. En cas d'égalité stricte de score global entre deux combinaisons, le départage se fait par la méthode du **leximin** : on compare les scores individuels des familles participantes (hors opt-out, comme pour le score global) triés du pire au meilleur, position par position, en commençant par la famille la moins bien servie ; la combinaison dont la famille la moins bien servie a le meilleur score l'emporte, et on continue avec la position suivante en cas de nouvelle égalité. Deux combinaisons ne sont considérées comme parfaitement équivalentes que si elles donnent un score strictement identique à chaque famille — dans ce cas précis (et uniquement celui-ci), l'ordre entre elles n'a pas d'importance.

**Étape 3 — Sélection des propositions présentées (entre 2 et 5).**
- Le planning au meilleur score global (départagé par leximin en cas d'égalité stricte, voir ci-dessus).
- Si le planning ayant le meilleur score minimum est différent du précédent, l'inclure également — c'est l'option "la plus équitable" — même si sa moyenne est légèrement inférieure.
- Compléter avec les meilleurs scores globaux suivants (toujours départagés par leximin), en excluant toute proposition dont le **profil de scores est strictement identique, famille par famille**, à une proposition déjà retenue — même si les semaines concrètement attribuées diffèrent. Deux propositions à profil de scores identique procurent une satisfaction rigoureusement égale à chaque famille et ne constituent donc pas un choix réel pour le vote.
- **Si moins de 2 combinaisons valides existent au total**, ou si le meilleur score minimum obtenu est sous le seuil configuré (section 4.1, défaut 40%) → basculer directement sur le mode de secours (section 4.7) au lieu de présenter des propositions.

### 4.6 Vote et décision finale

- Toutes les familles reçoivent un email avec un lien vers les propositions.
- Chaque famille voit, pour chaque proposition : le planning complet (qui a quelle semaine), le score global du planning, et **son propre** score individuel — jamais le détail des scores des autres familles.
- Chaque famille vote pour une seule proposition, avant la deadline de vote configurée. Les mêmes relances automatiques (J-7/J-3) s'appliquent que pour les préférences. Le vote peut être librement modifié tant que la deadline n'est pas atteinte.
- Passé la deadline, la décision se base sur les votes reçus ; une famille n'ayant pas voté est simplement exclue du décompte, sans bloquer le processus, et l'admin en est notifié.
- **Règle de décision** : la proposition ayant le plus de votes gagne. En cas d'égalité, celle avec le meilleur score global l'emporte automatiquement. À tout moment, l'admin peut forcer une décision différente via un bouton dédié, avec un commentaire justificatif obligatoire, visible par toutes les familles.
- Une fois décidé, le planning est **verrouillé**. Toute modification ultérieure (ex. échange manuel entre deux familles consentantes) nécessite une action admin explicite, journalisée dans l'historique (section 5).

### 4.7 Mode de secours — "aucun planning satisfaisant"

Cascade en trois niveaux, déclenchée automatiquement ou manuellement :

1. **Second tour ciblé (automatique)** : déclenché si aucune combinaison valide n'existe, ou si le meilleur score minimum est sous le seuil configuré. Le cycle passe au statut `collecte_tour2`. Réouverture de la saisie uniquement pour les familles concernées (celles dont le score serait sous le seuil), en leur montrant de façon **anonymisée** les semaines en tension (ex. "ces semaines sont demandées par plusieurs familles") — sans jamais révéler qui a demandé quoi. Elles peuvent ajuster leurs préférences. **Les préférences des familles non concernées restent verrouillées et inchangées pendant ce temps** — seules les familles ciblées peuvent modifier les leurs. **Un seul second tour automatique est autorisé par cycle** : s'il ne suffit pas à produire un planning satisfaisant, le système passe directement à la médiation (point 2) sans redéclencher de second tour.
2. **Médiation admin** : si le second tour échoue également, le cycle passe au statut `médiation` et l'admin accède à l'ensemble des préférences de toutes les familles en clair pour arbitrer manuellement l'attribution des semaines. Un commentaire justificatif est obligatoire et visible par toutes les familles concernées. Le second tour et la médiation réutilisent les écrans existants (formulaire de préférences, dashboard admin) avec un bandeau contextuel indiquant l'état du cycle — ce ne sont pas des écrans distincts à concevoir.
3. **Redémarrage complet du cycle** : à tout moment, l'admin peut choisir de relancer un cycle entièrement depuis zéro (remise à zéro des préférences, nouvel email à toutes les familles) — par exemple après une discussion informelle entre les familles.

### 4.8 Clôture et archivage

À la clôture de l'année (déclenchée manuellement par l'admin, ou automatiquement à la fin de la période de location), les données du cycle (droits attribués, préférences, planning retenu, scores obtenus) sont archivées et alimentent les statistiques historiques (section 5).

### 4.9 Semaines non réclamées

Après la décision finale (section 4.6), toute semaine de la période qui n'est attribuée à aucune famille — parce qu'elle n'a pas été demandée (offre supérieure à la demande), ou parce qu'elle a été libérée par un opt-out (section 4.2) — devient **disponible**.

- Chaque famille peut manifester son intérêt pour une semaine disponible en cliquant "Je suis intéressé".
- L'admin assigne ensuite manuellement la semaine à une famille intéressée, sans logique d'arbitrage automatique (pas de priorité calculée ni de règle "premier arrivé, premier servi" imposée par le système — l'admin tranche selon son jugement, par exemple après discussion entre les familles intéressées).
- Ce mécanisme est entièrement séparé de l'algorithme de génération (section 4.5) : il ne s'applique qu'aux semaines déjà exclues du planning principal, et n'a aucune influence sur les scores calculés en section 4.5.

---

## 5. Statistiques et historique

- Sur les 5 dernières années glissantes, pour chaque famille : nombre de fois où elle a eu 2 semaines, année de la dernière occurrence, score de satisfaction moyen obtenu.
- Affiché à l'admin lors de la configuration annuelle comme aide à la décision (section 4.1) — jamais comme calcul automatique imposé.
- **Visibilité** : ces statistiques (nombre de fois avec 2 semaines, score de satisfaction moyen) sont visibles par **toutes les familles pour toutes les familles**, pas seulement les siennes — cohérent avec la transparence déjà appliquée au reste du processus (suivi de complétion, plannings proposés).
- **Modifiable par l'admin à tout moment** (correction d'erreur), avec un **journal d'audit** obligatoire : chaque modification enregistre qui a modifié, quand, l'ancienne valeur et la nouvelle valeur. Le journal est consultable par tout admin.
- Il n'existe pas de table de statistiques séparée : les indicateurs sont recalculés directement à partir des données archivées (`FamilyRight`, `FinalSchedule`) des cycles clôturés. Modifier une donnée archivée (ex. corriger le nombre de semaines d'un cycle passé) met donc automatiquement à jour les statistiques affichées, sans étape de synchronisation supplémentaire.

### 5.1 Import de l'historique antérieur à l'application

Le bien dispose déjà de plusieurs années (5 ou plus) d'historique réel de répartition (quelle famille a eu 1 ou 2 semaines, quelle année), accumulé avant la mise en place de l'application. Pour que l'aide à la décision (section 4.1) soit utile dès le premier cycle réellement géré par l'app, l'admin doit pouvoir saisir cet historique manuellement, sans attendre 5 années d'usage.

- Écran dédié "Import de l'historique" (admin) : un tableau années × familles, où l'admin saisit pour chaque année passée et chaque famille le nombre de semaines qu'elle a eu (1 ou 2, ou vide si non applicable).
- Chaque année saisie crée un `Cycle` avec `origine = importé` et `statut = clôturé` directement, associé uniquement aux `FamilyRight` correspondants — sans `WeekSlot`, `Preference`, `ScheduleProposal`, `Vote` ni `FinalSchedule`, puisque ces données n'ont jamais existé pour ces années-là. Les champs sans objet pour un cycle importé (dates, deadlines, seuil de score minimum) restent simplement vides.
- Un `Cycle` est unique par (`propertyId`, `année`) — importé ou non, une seule entrée par année pour un bien donné, afin d'éviter les doublons ou les chevauchements entre un import et un cycle réel.
- Un cycle importé **ne contribue jamais** au "score de satisfaction moyen" (cette donnée n'existe pas pour l'historique manuel) ; il contribue uniquement au nombre d'occurrences de 2 semaines et à l'ancienneté de la dernière occurrence.
- Cet écran reste accessible après le lancement (pas seulement à l'installation initiale), pour corriger ou compléter l'historique à tout moment — il réutilise les mêmes règles de modification et de journal d'audit que le reste de la section 5.

---

## 6. Notifications email (liste exhaustive)

1. Code OTP de connexion.
2. Invitation à saisir les préférences (ouverture du cycle).
3. Relance J-7 et J-3 avant la deadline des préférences (familles n'ayant pas encore répondu).
4. Notification admin : toutes les réponses sont arrivées, ou deadline dépassée avec réponses manquantes.
5. Notification familles : les propositions de planning sont prêtes, lien vers le vote.
6. Relance J-7 et J-3 avant la deadline de vote (familles n'ayant pas encore voté).
7. Notification : planning final confirmé.
8. Notification : basculement en second tour / mode médiation (aux familles concernées).
9. Notification : des semaines sont disponibles suite à un opt-out ou une non-demande (aux familles, avec lien vers la page des semaines non réclamées, section 4.9).

---

## 7. Modèle de données (entités principales)

- **Property** (bien) : id, nom, jourBascule (jour de la semaine, défaut samedi)
- **User** (famille) : id, email, nomAffiché, isAdmin (bool), actif (bool, défaut true — une désactivation remplace toute suppression afin de préserver l'historique), propertyId
- **Cycle** (année) : id, propertyId, année, dateDébut, dateFin, deadlinePréférences, deadlineVote, seuilScoreMinimum, statut (config / collecte / collecte_tour2 / médiation / génération / vote / clôturé), origine (généré / importé — voir section 5.1)
- **FamilyRight** (droit annuel) : id, cycleId, userId, nombreSemaines (1 ou 2), accepteFractionnement (bool) — unique par (cycleId, userId)
- **WeekSlot** (semaine) : id, cycleId, dateDébut, dateFin, ordre
- **Preference** : id, cycleId, userId, weekSlotId, statut (préférée / alternative / impossible / non-coché), horodatage — unique par (cycleId, userId, weekSlotId)
- **OptOut** : id, cycleId, userId
- **WeekInterest** (intérêt pour une semaine non réclamée, section 4.9) : id, cycleId, weekSlotId, userId, horodatage
- **ScheduleProposal** (planning proposé) : id, cycleId, scoreGlobal, scoreMinimum, généréLe
- **ScheduleAssignment** (attribution) : id, scheduleProposalId, userId, weekSlotId, scoreIndividuel, fractionnementForcé (bool)
- **Vote** : id, cycleId, scheduleProposalId, userId, horodatage — unique par (cycleId, userId)
- **FinalSchedule** (planning retenu) : id, cycleId, scheduleProposalId (nullable si médiation manuelle), décidéPar (auto / admin), commentaireAdmin
- **AuditLog** : id, tableConcernée, enregistrementId, champ, ancienneValeur, nouvelleValeur, modifiéPar, horodatage — table **strictement en ajout seul** (insert-only) : aucune entrée n'est jamais modifiée ni supprimée, même par un admin, sous peine de vider le journal de son utilité
- **OtpCode** : id, userId, code, expiration, nombreTentatives

---

## 8. Écrans / pages nécessaires

- Connexion (email → code OTP)
- Dashboard famille : cycle en cours, statut, accès au formulaire de préférences, accès au vote
- Formulaire de préférences (grille des semaines avec sélection de statut, case fractionnement, bouton opt-out)
- Page de suivi de complétion (qui a répondu / qui est en attente)
- Page de vote (comparatif des propositions de planning, score global et score personnel)
- Page des semaines non réclamées (familles : bouton "je suis intéressé" ; admin : assignation manuelle, section 4.9)
- Dashboard admin : configuration du cycle, gestion des droits annuels, statistiques 5 ans, bouton de génération, mode médiation, journal d'audit
- Gestion des utilisateurs (admin) : créer/modifier une famille, gérer le rôle admin
- Page historique / statistiques (lecture pour tous, édition réservée à l'admin)
- Écran d'import de l'historique antérieur (admin uniquement, tableau années × familles, section 5.1)

---

## 9. Exigences non-fonctionnelles

- **Langue** : français uniquement.
- **Responsive** : conception mobile-first (les familles rempliront probablement le formulaire depuis leur téléphone).
- **Échelle** : usage confidentiel, quelques familles (4 à 8), aucune contrainte de performance particulière.
- **Sécurité** :
  - Cookies de session httpOnly + secure + sameSite=strict ; OTP à usage unique, haché en base, à durée limitée ; aucun mot de passe stocké.
  - HTTPS obligatoire sur l'ensemble de l'application (fourni nativement par Vercel).
  - **Aucun lien d'email n'exécute directement une action.** Un lien reçu par email (vote, confirmation, etc.) ouvre uniquement une page ; l'action elle-même nécessite un clic explicite sur un bouton depuis cette page (requête POST authentifiée). Ceci évite qu'un scanner de sécurité automatique (Outlook Safe Links, protection anti-phishing Gmail, etc.), qui "pré-clique" les liens des emails reçus, ne déclenche une action par accident.
  - Toutes les entrées utilisateur sont validées côté serveur (dates, statuts de préférence, emails), jamais uniquement côté client.
  - Secrets (clé API Resend, chaîne de connexion Neon, secret de session) uniquement via variables d'environnement, jamais committés dans le code source (voir section 11).
- **Accessibilité** : contrastes suffisants, formulaires navigables au clavier (bonnes pratiques standards, aucune norme spécifique imposée).

---

## 10. Stack technique retenue

| Composant | Choix |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Base de données | PostgreSQL managé (Neon) |
| ORM | Prisma |
| Authentification | OTP maison par email, session via cookie sécurisé (pas de fournisseur externe) |
| Emails | Resend (OTP + toutes les notifications listées en section 6) |
| UI / styles | Tailwind CSS — **utiliser la dernière version stable majeure disponible au moment du développement** (ne pas figer sur une version ancienne : une migration majeure de Tailwind est coûteuse, autant démarrer directement sur la version courante) |
| Composants UI | shadcn/ui |
| Hébergement | Vercel (application) + Neon (base de données) |

---

## 11. Prérequis avant développement

Éléments à préparer par le porteur du projet avant de lancer le développement — sans eux, l'IA de développement sera bloquée sur des dépendances externes qu'elle ne peut pas résoudre elle-même :

- Un compte Resend avec un **domaine d'envoi vérifié** (sans quoi les codes OTP et les notifications risquent d'atterrir en spam ou d'être rejetés).
- Une base de données PostgreSQL managée sur Neon (chaîne de connexion à fournir).
- Un compte Vercel pour l'hébergement.
- Un secret de session (valeur aléatoire) pour signer les cookies d'authentification.
- La liste des familles à créer au lancement (nom et email de chacune) et l'identification de qui sera admin au départ.
- Les données de l'historique existant (au moins 5 ans : pour chaque année et chaque famille, le nombre de semaines qu'elle a eu), à saisir après le déploiement via l'écran d'import (section 5.1) — pas besoin de les préparer sous une forme technique particulière, un simple tableau suffit.

---

## 12. Limites connues et points d'évolution

Ces points ne sont pas des manques du système décrit ci-dessus, mais des endroits repérés où une évolution future demanderait un travail de conception dédié — utile si tu modifies le périmètre plus tard :

- **Droit supérieur à 2 semaines** : toute la logique de fractionnement (sections 4.2 et 4.5) est pensée spécifiquement pour le cas "1 ou 2 semaines". Un droit à 3 semaines ou plus nécessiterait de généraliser cette logique (quelles combinaisons de fractionnement sont acceptables, quel score forfaitaire appliquer).
- **Granularité des préférences** : le système utilise 4 statuts fixes (préférée / alternative / non coché / impossible). Une granularité plus fine (ex. classement des semaines par ordre de préférence) donnerait des scores plus différenciés, mais demanderait de revoir le modèle `Preference` et l'algorithme de notation (section 4.5).
- **Multi-langue** : l'application est prévue en français uniquement (section 9). Un passage multi-langue toucherait tous les emails (section 6) et toutes les interfaces (section 8).
- **Constantes de score centralisées** : les valeurs 100% / 70% / 40% / 30% (sections 4.2 et 4.5) doivent être définies comme des constantes de configuration à un seul endroit dans le code, jamais dupliquées, pour rester facilement ajustables sans repasser par tout le code.
- **Multi-bien** : déjà anticipé dans le modèle de données (section 3) — un second bien peut être ajouté sans refonte de schéma. En revanche, l'interface actuelle (section 8) suppose implicitement un seul bien à la fois ; gérer plusieurs biens en parallèle dans une même session utilisateur demanderait d'ajouter un sélecteur de bien dans l'interface.

---

## 13. Glossaire

- **Bien** : la résidence partagée, entité racine du modèle de données.
- **Cycle** : une itération annuelle complète du processus, pour un bien donné.
- **Droit annuel** : nombre de semaines (1 ou 2) qu'une famille peut réserver pour un cycle donné.
- **Semaine** : unité de réservation, du samedi au samedi, sans exception.
- **Fractionnement** : attribution à une famille "2 semaines" de deux semaines non consécutives.
- **Score** : mesure de satisfaction d'une famille (0-100%) ou d'un planning (moyenne des scores familles).
- **Mode de secours** : cascade de résolution (second tour → médiation → redémarrage de cycle) en cas d'absence de planning satisfaisant.
- **Leximin** : méthode de départage entre plannings à score global égal, comparant les scores des familles triés du pire au meilleur (section 4.5).
- **Semaine non réclamée** : semaine non attribuée à l'issue de la décision finale, ouverte aux manifestations d'intérêt des familles (section 4.9).
- **Cycle importé** : entrée d'historique antérieure à l'application, saisie manuellement, ne comportant que le droit annuel (nombre de semaines) sans planning ni score de satisfaction (section 5.1).
