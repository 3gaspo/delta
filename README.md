# Delta

Delta permet de suivre ses finances personnelles : comptes, opérations, récurrences et statistiques. L’application propose un mode local et un mode Firebase pour retrouver ses données avec un compte utilisateur.

## Fonctionnalités

- Comptes courants et comptes de dette, soldes initiaux, archivage, ordre et partage des dépenses.
- Dépenses, revenus, virements, opérations groupées, statuts en attente ou masqués, catégories colorées et tags.
- Règles récurrentes, abonnements, prévisions de trésorerie et alertes ; choix de conserver ou supprimer l’historique lors de la suppression d’une règle.
- Historique avec recherche et filtres, statistiques de soldes, flux financiers et répartition par catégorie.
- Export CSV et choix de la devise d’affichage : EUR, USD, JPY ou GBP.
- Import assisté CIC et BoursoBank via un userscript, avec aperçu, détection de doublons et validation avant enregistrement.
- Thèmes clair et sombre persistants et interface adaptée aux petits écrans.

## Écrans

| URL | Écran |
| --- | --- |
| `/home` | Home : historique, recherche, filtres et ajout d’opération |
| `/accounts` | Accounts : comptes, récurrences et prévisions |
| `/stats` | Statistics |
| `/settings` | Settings : catégories, tags, devise, thème, compte et export |
| `/import` | Aperçu et validation d’un import bancaire |

La racine `/` redirige vers l’accueil. La connexion s’affiche lorsqu’aucune session n’est active. Les écrans secondaires sont chargés à la demande.

## Stack et organisation

React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, React Router, Lucide et Firebase Authentication / Firestore, avec Recharts pour les graphiques.

- [src/pages/](src/pages/) : écrans de l’application.
- [src/providers/](src/providers/) : authentification, données et thème.
- [src/components/accounts/](src/components/accounts/) et [src/components/transactions/](src/components/transactions/) : formulaires et présentation des comptes et opérations.
- [src/utils/](src/utils/) : calculs financiers, flux et récurrences.
- [src/lib/bankImport.ts](src/lib/bankImport.ts) : validation et identification des lignes importées.
- [scripts/](scripts/) et [tests/](tests/) : construction du userscript et tests de l’import et des calculs.
- [src/styles/](src/styles/) : imports des styles partagés et styles propres à l’application.

## Installation

Environnement de référence : Node.js 24 et npm. Exécuter les commandes depuis ce dépôt.

```bash
npm ci
npm run dev
```

Le serveur de développement écoute sur le port 3000. Ouvrir `http://localhost:3000`.

## Configuration et données

Sans configuration Firebase complète, Delta utilise le stockage local du navigateur et crée une session de développement au premier lancement.

Le mode local conserve ses données dans le `localStorage` du navigateur, sans synchronisation entre appareils. Sa session de développement n’est pas une authentification distante. Changer de mode de stockage ne transfère pas automatiquement ces données.

Pour utiliser Firebase, copier [.env.example](.env.example) vers `.env.local` et renseigner la configuration de l’application web :

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Activer l’authentification email/mot de passe et Firestore dans le projet Firebase concerné. Ces variables sont lues par Vite au démarrage et lors du build : redémarrer le serveur ou reconstruire après une modification. Conserver les fichiers d’environnement locaux hors Git.

## Commandes et validation

| Commande | Rôle |
| --- | --- |
| `npm ci` | Installer les versions du lockfile, y compris l’archive UI locale |
| `npm run dev` | Lancer le serveur de développement sur le port 3000 |
| `npm run lint` | Vérifier les types avec `tsc --noEmit` |
| `npm run check:ui` | Vérifier l’archive UI, son empreinte, le lockfile et les réexports |
| `npm run build` | Exécuter `prebuild` puis générer le site statique dans `dist/` |
| `npm run preview` | Prévisualiser le dernier build localement |

`npm run test:bank-import` couvre l’extraction et la validation des imports ainsi que la détection des doublons.

## Import bancaire

Installer [public/delta-bank-import.user.js](public/delta-bank-import.user.js) dans un gestionnaire de userscripts compatible avec les API `GM_*`. Sur une page d’opérations CIC ou BoursoBank prise en charge, charger les opérations souhaitées puis utiliser **Import transactions**. Delta ouvre un brouillon : choisir le compte, vérifier les lignes et valider leur enregistrement.

Le script lit les opérations déjà chargées dans la page bancaire. L’import est limité aux opérations en EUR ; il ne constitue pas une connexion bancaire automatique. Le transfert temporaire du brouillon expire après 30 minutes.

La destination actuelle est `https://delta-d85d8.web.app`, avec une option de développement vers `http://localhost:3000` dans le menu du userscript. Un autre domaine nécessite d’adapter les URL autorisées et la destination dans les sources du script.

Après modification de [scripts/bank-extractors.mjs](scripts/bank-extractors.mjs), [scripts/userscript-runtime.js](scripts/userscript-runtime.js) ou de l’en-tête du script :

```bash
npm run build:userscript
npm run test:bank-import
```

Les tests financiers se lancent avec `node --import tsx --test tests/financial.test.ts`. Le test navigateur [tests/bank-import.browser.mjs](tests/bank-import.browser.mjs) nécessite Chrome, Playwright et Delta en mode local sur le port 3000 ; ses prérequis sont indiqués en tête du fichier.

## Interface partagée

L’application utilise `@3gaspo/app-ui`, actuellement en version 0.1.6, pour la navigation, les titres, dialogues, formulaires, commandes, retours d’état et formats visibles. L’interface utilise Inter et des thèmes clair et sombre communs. Les dates affichées utilisent `en-GB` et les heures le format 24 h ; les formats de stockage et d’export restent propres à l’application.

L’archive est incluse dans [vendor/](vendor/) et référencée par `package.json` et `package-lock.json`. Ce dépôt est installable et déployable seul : aucun accès au dépôt source voisin `app-ui` ni à un registre privé n’est nécessaire. Relancer `npm ci` après un pull qui change les dépendances. La vérification du package partagé s’exécute automatiquement avant le build.

## Déploiement

Le site statique est servi par Firebase Hosting depuis `dist/`. [firebase.json](firebase.json) redirige les routes de l’application vers `index.html` et déclare aussi les règles et index Firestore.

Après avoir authentifié la CLI Firebase et sélectionné le bon projet :

```bash
git pull
npm ci
npm run build
firebase deploy --only hosting
```

Ajouter `--project ID_DU_PROJET` si aucun projet n’est sélectionné. Un `firebase deploy` sans restriction peut aussi publier les règles et index Firestore déclarés. Un retour à une version conservée dans l’historique Firebase Hosting restaure le site, pas les données.
