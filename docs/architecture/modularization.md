# Gaia — architecture modulaire et plan de migration

## Objectif et règles non négociables

Gaia est un projet autonome. Cette migration vise à organiser le code en modules métier sans réécrire l'application et sans perdre les fonctionnalités déjà livrées.

- Toute modification doit être faite sur `Features-gaia`.
- Ne jamais modifier `main`, créer une branche ou toucher au README dans le cadre de cette migration.
- Préserver les trois modules déjà construits, leurs parcours UI, leurs données Prisma, leurs contrats API et leurs comportements.
- Ne supprimer un ancien point d'entrée qu'après migration de tous ses consommateurs et vérification.
- Ne pas effectuer de déplacement massif du code.
- Ne pas déclarer un test, un lint ou un build exécuté sans preuve d'exécution réelle.

## État observé sur la branche

HEAD audité : `c3881504e34a6479030e7f2736dbc8105fec0a58`.

- Next.js App Router et TypeScript strict sont déjà en place.
- Les routes métier existent sous `src/app/api/gaia`.
- Les routes `src/app/api/v1/gaia` réutilisent les routes existantes : conserver cette compatibilité et éviter la duplication.
- Le service `src/server/gaia.ts` contient environ 3 883 lignes et concentre Notes, dossiers, tags, templates, mémoire/révision, Knowledge, collections, canvas, inbox et Files.
- Les composants sont regroupés dans `src/components/gaia`. Les fichiers particulièrement volumineux incluent l'éditeur, les blocs, les hooks/types partagés, les panneaux et la gestion des fichiers.
- Les utilitaires métier existent déjà dans `src/lib/gaia` : contenu/blocs, arbre, liens/références, knowledge, répétition espacée, templates, versioning et fichiers.
- Les responsabilités partagées existent déjà dans `src/lib/db.ts`, `src/server/session.ts`, `src/server/storage.ts` et `src/server/api.ts`.
- `src/modules`, `src/shared` et `src/infrastructure` ne sont pas encore présents.
- Le script npm actuel expose `build`, `dev`, `start` et les commandes Prisma, mais pas de scripts dédiés `test`, `lint` ou `typecheck`.

Cet état est un audit statique du dépôt. Aucun build ni test n'a été exécuté dans cet environnement.

## Architecture cible

```
src/
├── app/
│   ├── api/                 # Adaptateurs HTTP Next.js uniquement
│   └── ...                  # Pages, layouts et routing
├── modules/
│   ├── editor/
│   │   ├── components/
│   │   ├── domain/
│   │   ├── services/
│   │   └── types/
│   ├── notes/
│   │   ├── components/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── types/
│   ├── knowledge/
│   │   ├── components/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── types/
│   ├── files/
│   │   ├── components/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── storage/
│   │   └── types/
│   └── productivity/       # À créer seulement si le périmètre métier est confirmé
├── shared/
│   ├── auth/
│   ├── components/
│   ├── database/
│   ├── schemas/
│   ├── storage/
│   └── utils/
└── infrastructure/
    ├── ai-providers/       # Réservé à une évolution future
    ├── integrations/       # Réservé à une évolution future
    └── search/             # Réservé à une évolution future
```

Les domaines futurs ne doivent pas être créés sous forme de dossiers vides. Ils seront ajoutés lorsqu'une fonctionnalité réelle les justifiera.

## Frontières métier proposées

### Editor

Responsable du modèle de blocs, de l'arbre, des opérations d'édition, de la synchronisation des blocs, des commandes et des composants de l'éditeur.

Candidats existants à analyser avant déplacement :
- `src/lib/gaia/content.ts`
- `src/lib/gaia/tree.ts`
- `src/lib/gaia/inline.ts`
- `src/lib/gaia/table.ts`
- `src/components/gaia/gaia-editor.tsx`
- `src/components/gaia/gaia-blocks.tsx` et composants associés

Le modèle de blocs doit rester compatible avec les notes existantes et les blocs de fichiers.

### Notes

Responsable du cycle de vie des notes, dossiers, tags, versions de notes, propriétés, modèles, inbox et notes quotidiennes/hebdomadaires.

Le module Notes reste propriétaire des entités Note et NoteFolder. Les autres modules ne doivent pas contourner ses règles d'accès.

### Knowledge

Responsable des relations entre notes, backlinks, suggestions, graphes, collections intelligentes, timeline et canvas de connaissances.

Il dépend des contrats publics de Notes pour lire les notes, mais ne doit pas dupliquer le stockage ni le cycle de vie des notes.

### Files

Responsable des fichiers, versions de fichiers, annotations, pièces jointes, métadonnées, OCR/texte extrait et opérations Storage.

Les fichiers liés à une note doivent passer par des services explicites Notes/Files. Le module Files ne doit jamais faire confiance à un identifiant fourni par le client sans vérifier son propriétaire.

### Shared

Responsable des capacités réellement transversales : client Prisma, session/authentification, stockage partagé, validation commune, composants génériques et utilitaires sans logique métier spécifique.

### Infrastructure

Responsable des adaptateurs techniques externes (fournisseurs IA, recherche externe, intégrations). Ne pas y déplacer les règles métier de Notes, Knowledge ou Files.

## Règles de dépendances

1. `app/api` appelle les services publics des modules ; aucune logique métier importante ne doit rester dans les handlers HTTP.
2. Un module peut dépendre de `shared` et de contrats publics d'un autre module, jamais de ses détails internes.
3. Éviter les dépendances circulaires. Les interactions intermodules passent par des services/fonctions d'application explicitement exposés.
4. Prisma est accédé côté serveur seulement, via une seule instance partagée.
5. Les composants client ne doivent jamais importer un service serveur, Prisma, secrets ou code Storage privilégié.
6. Les DTO et schémas d'entrée/sortie exposés par l'API restent stables pendant la migration.
7. Les routes API versionnées restent des adaptateurs de compatibilité vers les mêmes handlers, sans seconde implémentation.
8. Les anciens imports peuvent être conservés via des façades temporaires, le temps de migrer tous les consommateurs.

## Séquence de migration

### Étape 0 — Cartographie et filet de sécurité

- Recenser chaque route API et les fonctions du service central qu'elle consomme.
- Recenser les consommateurs client des hooks, types et composants partagés.
- Identifier les types Prisma/DTO, helpers privés et dépendances inter-domaines.
- Établir les parcours critiques des trois modules et les commandes de vérification réellement exécutables.
- Ne déplacer aucun code tant que les dépendances d'une tranche ne sont pas comprises.

### Étape 1 — Fondations sans changement de comportement

- Définir les points d'entrée publics de chaque module.
- Définir les règles d'import et les conventions de nommage.
- Installer les premiers répertoires seulement avec du code réel.
- Conserver les chemins historiques via des façades lorsque cela réduit le risque.
- Ne pas modifier le schéma Prisma ni les contrats HTTP dans cette étape.

### Étape 2 — Extraction du serveur par tranches métier

Ordre recommandé :
1. Files, isolé en premier seulement après cartographie complète de ses dépendances (Storage, Notes, dossiers, DTO et erreurs).
2. Knowledge, en séparant ses requêtes et services sans dupliquer Notes.
3. Notes, avec ses schémas, repositories, DTO et services.
4. Editor, en séparant le modèle pur de blocs des composants UI et du service de persistance.

Chaque tranche doit être petite, compilable et réversible. Le fichier historique `src/server/gaia.ts` reste une façade de compatibilité tant que tous les handlers et consommateurs ne sont pas migrés.

### Étape 3 — Déplacement progressif de l'UI et des utilitaires

- Déplacer les composants par fonctionnalité, sans renommer les composants publics à la même étape.
- Séparer les types client des types serveur.
- Déplacer les hooks React Query vers le module qui possède la fonctionnalité.
- Garder des réexports temporaires depuis `src/components/gaia` pour éviter de casser les imports.

### Étape 4 — Shared et infrastructure

- Centraliser les accès Prisma, auth/session, Storage et utilitaires réellement transversaux.
- Ne pas transformer `shared` en dossier fourre-tout.
- Vérifier qu'aucun code serveur privilégié n'est importé côté client.

### Étape 5 — Nettoyage contrôlé et validation

- Supprimer les façades historiques uniquement après recherche globale des imports.
- Vérifier les routes API classiques et versionnées.
- Vérifier les parcours Notes, Editor, Knowledge et Files.
- Exécuter typecheck, lint, tests, build et tests navigateur dès que les scripts/environnements nécessaires sont disponibles.
- Vérifier le déploiement Preview avant de considérer la migration terminée.

## Critères d'acceptation de chaque tranche

- Aucun endpoint supprimé ou modifié involontairement.
- Aucun champ Prisma, DTO ou contrat client perdu.
- Aucun comportement existant retiré.
- Aucun import circulaire ou import serveur dans un bundle client.
- Isolation utilisateur conservée sur toutes les lectures et écritures.
- Vérification des types et tests adaptés exécutés avec résultats consignés.
- Diff limité à la tranche annoncée, sans changement de `main` ni du README.

## Risques à traiter séparément

L'audit a également identifié des risques fonctionnels/sécurité (identifiants RLS, sessions, rate limiting, upload Vercel, quotas et validation de relations). Ils appartiennent aux lots de correction A à D et ne doivent pas être mélangés à une extraction purement architecturale sans tests ciblés.
