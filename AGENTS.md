# Guide commun aux agents

La mémoire durable de MetaCarScore est versionnée dans ce repository. Les mémoires
natives des agents servent seulement de pointeurs vers ces documents. Le code établit
ce qui est implémenté ; il ne suffit pas à établir l'intention produit.

## Repères et invariants

- Lire le [README](README.md) pour démarrer. Selon la tâche, consulter le
  [contexte produit](docs/PROJECT_CONTEXT.md), l'[architecture](docs/ARCHITECTURE.md),
  les [décisions](docs/DECISIONS.md) ou les [questions ouvertes](docs/KNOWN_ISSUES.md).
- Préserver la moyenne des scores d'essais, l'arrondi final unique et la distinction
  entre fiabilité globale (3 sources) et score filtré (3 essais). Les détails et
  exceptions sont dans le contexte produit.
- Distinguer le véhicule réellement testé de son identité canonique : conserver le
  libellé original, consolider les essais et construire les liens canoniques. Ne pas
  fusionner des années-modèles distinctes dans un classement de modèles.
- Utiliser les migrations Supabase incrémentales. Pour faire évoluer une RPC publique,
  ajouter une version et migrer les appels sans casser les clients existants ; toute
  suppression de version et tout élargissement d'accès exigent une décision explicite.
- Préserver la frontière de sécurité : validation des entrées des Server Actions,
  échappement PostgREST et `serializeJsonLd`, politiques RLS et privilèges des RPC.
  Ne pas mettre de clé privilégiée dans le frontend, ni de secret, donnée personnelle
  ou configuration sensible dans Git ou les journaux de validation.
- Respecter TypeScript strict et ESLint. `package-lock.json` est le verrou versionné ;
  éviter un second verrou concurrent. Ne pas recopier dans la mémoire les détails
  déjà exprimés par le code et ses tests.

## Validation

Choisir les vérifications pertinentes selon l'[architecture](docs/ARCHITECTURE.md#validation).
Signaler séparément les échecs préexistants, les contrôles non exécutés et ceux qui
échouent à cause du changement. Un mock ne valide ni le SQL déployé ni les données
réelles. Une modification documentaire seule ne nécessite pas de déploiement applicatif.

## Maintenance et évolution de la mémoire du projet

- **Vérification contextuelle.** Pour une fonctionnalité, correction, refonte ou revue,
  lire uniquement les documents utiles à la tâche, sans charger toute la mémoire
  pour une modification mineure.
- **Détection.** Signaler avec des éléments vérifiables toute erreur architecturale,
  décision obsolète, contradiction documentation/code, nouvelle contrainte durable,
  règle inutile ou changement important invalidant une connaissance.
- **Proposition.** Indiquer la connaissance concernée, la raison du changement,
  les preuves (code, tests ou décision explicite), le texte exact à ajouter, modifier
  ou supprimer et les conséquences possibles. Si la tâche autorise les modifications
  documentaires, proposer la correction dans la même PR ou une PR documentaire.
  En simple revue, formuler une recommandation sans supposer le droit de modifier
  le repository. Aucune mise à jour de mémoire ne doit être fusionnée automatiquement.
  Soumettre au mainteneur les désaccords importants sur le métier ou l'architecture.
- **Prévention de l'accumulation.** Ne pas enregistrer automatiquement conversations,
  prompts ponctuels, raisonnements intermédiaires, tentatives abandonnées sans effet
  durable, consignes propres à un ancien modèle, faits temporaires ou doublons.
  Toute nouvelle connaissance doit être durable, vérifiable et non redondante.
- **Révision continue.** Lorsqu'une décision en remplace une autre, actualiser le
  document existant ; conserver la justification utile, sans empiler des règles
  contradictoires ni tout leur historique. Supprimer les consignes inutiles.
- **Indépendance des modèles.** Décrire les objectifs, invariants et contraintes
  vérifiables. Ne pas imposer de méthode de raisonnement, procédure excessive ou
  contournement propre à une génération d'IA sans besoin technique actuel démontré.
  Laisser aux agents le choix de leurs méthodes de résolution.
