# Sillage · Prospection 404NotFood

Application privée Next.js / TypeScript avec BetterAuth, PostgreSQL,
shadcn/ui et Magic UI. L’accueil affiche directement la connexion.
Il n’y a plus de parcours de démonstration ni d’inscription publique.

## Dépôt GitHub

Dépôt : https://github.com/404notfood/prospection — branche `main`.

Publier **le contenu du dossier `site` à la racine du dépôt** : `package.json`,
`package-lock.json`, `app`, `components`, `lib`, `scripts`, `tests`, etc.
Le générateur est configuré avec un dossier Next.js `.` et un build à la racine.
Ne pas publier `.env.local`, `.env.production`, les bases locales ou `node_modules`.

## Générateur VPS préparé

Le formulaire https://404notfood.fr/generateur/project.html est configuré ainsi :

| Paramètre                  | Valeur                                                     |
| -------------------------- | ---------------------------------------------------------- |
| Projet / utilisateur Linux | `prospection`                                              |
| Sources                    | Git · `https://github.com/404notfood/prospection` · `main` |
| Domaine                    | `prospection.404notfood.fr`                                |
| Stack                      | Next.js SSR · sortie standard                              |
| Dossier Next.js            | `.`                                                        |
| Node / gestionnaire        | Node 24 · npm                                              |
| Supervision                | systemd · processus `prospection`                          |
| Port                       | Automatique, uniquement sur `127.0.0.1`                    |
| Base                       | PostgreSQL · base et rôle `prospection`                    |
| Connexion                  | `DATABASE_URL` construite automatiquement                  |
| Fichier de production      | `.env.production`                                          |
| Modèle                     | `.env.example`                                             |
| Origine d’authentification | `https://prospection.404notfood.fr`                        |
| Compte privé et certificat | `contact@404notfood.fr`                                    |
| Initialisation avant build | `npm run db:setup`                                         |
| Vérifications              | `types`, `lint`, `test`, `check:lines`                     |
| Sauvegardes                | PostgreSQL et configuration chiffrés, rétention 14 jours   |

Le générateur crée les mots de passe DB, `BETTER_AUTH_SECRET`, `OWNER_PASSWORD`
et la clé de chiffrement des sauvegardes **sur le VPS**. Aucun secret n’est
saisi dans le formulaire ou exporté dans le bundle.

Le profil n’utilise ni Prisma, ni Redis, ni processus IA, ni service mail intégré.
Les tables BetterAuth et la table des données de prospection sont créées par
`db:setup`. Le compte privé est créé à la première installation ; les passages
suivants conservent son mot de passe. Un email différent d’un compte déjà présent
interrompt l’initialisation au lieu d’ajouter un autre compte.

## Installation sur le VPS

1. Pousser les fichiers du projet à la racine de la branche `main` sur GitHub.
2. Faire pointer le DNS de `prospection.404notfood.fr` vers le VPS.
3. Sur la dernière page du générateur, télécharger puis décompresser le ZIP.
4. Sur le VPS, dans le dossier du bundle :

```bash
sudo bash ./install.sh --preflight
sudo bash ./install.sh
```

Le socle du générateur doit déjà fournir Debian 13, Node 24, PostgreSQL, Nginx,
Certbot et `pg_dump`. Si le dépôt est privé, préparer l’accès Git du compte Linux
`prospection` avant le clone ; aucun token n’est inséré dans le générateur.

Le script crée la base dédiée, remplit `.env.production`, installe les dépendances,
initialise les tables et le compte, effectue les contrôles, compile et démarre le site.
L’URL de connexion sera https://prospection.404notfood.fr.

Le mot de passe initial du **compte web** est la valeur `OWNER_PASSWORD` du fichier
`/home/prospection/app/.env.production`, lisible uniquement sur le VPS par les
comptes autorisés. Il n’est pas affiché dans les journaux d’installation.
Le mot de passe Linux SSH/SFTP demandé par le générateur est un accès distinct.

Les sauvegardes chiffrées restent locales dans
`/home/prospection/backups/postgresql`. Une destination extérieure pourra être
configurée ensuite. Conserver la clé `BACKUP_ENCRYPTION_KEY` pour les restaurer.
Avant une mise à jour faisant évoluer le schéma, effectuer une sauvegarde valide.
Le générateur conserve un dépôt déjà cloné : les `git pull` restent manuels.

## Démarrage local

```bash
npm install
```

Copier `.env.example` vers `.env.local`, conserver
`BETTER_AUTH_URL=http://localhost:3000`, définir `BETTER_AUTH_SECRET` aléatoire
(32 caractères minimum), `OWNER_EMAIL` et `OWNER_PASSWORD` (12 caractères minimum).
`OWNER_NAME` correspond au nom du compte. `DATABASE_URL` vide utilise SQLite en
local ; renseigner une URL PostgreSQL pour utiliser une base locale dédiée.

```bash
npm run db:setup
npm run dev
```

Ouvrir http://localhost:3000 : le formulaire de connexion est directement visible.
Un compte authentifié retrouve `/app`. Les données des prospects démarrent vides.
Sans initialisation des variables et de la base, la connexion ne peut pas aboutir.

L’ancien script interactif `npm run account:setup` reste disponible ; il utilise
la même initialisation et peut demander l’email s’il n’est pas configuré.
En production, `DATABASE_URL` est requis sauf installation SQLite explicitement
configurée via `SQLITE_PATH`. PostgreSQL est le stockage choisi pour ce VPS.

## Fonctions de la V1

- Compteurs calculés, campagnes et historique des échanges.
- Campagnes avec ciblage géographique, critères, offre, modèle et taille de lot.
- Liste des prospects : recherche, filtres, tri, pagination et export CSV.
- Fiches : identité, coordonnées, sources, vérifications, notes et relances.
- Liens directs vers le site, l’audit SEO et la fiche Google, dès la saisie et dans la liste.
- Recherche du site et de la fiche Google, automatique par lot ou à la demande.
- Qualification séquentielle par lots et reprise des informations conservées.
- Modèles d’email, aperçu, personnalisation et ouverture de la messagerie.
- Catalogue : tarifs indicatifs, conditions et disponibilité des prestations.
- Paramètres : identité, signature, source et sauvegardes JSON.

Une qualification exige une date de vérification et des faits observés.
Un champ web vide reste à vérifier. Les oppositions bloquent les contacts.
L’ouverture de la messagerie ne consigne pas automatiquement un envoi.
Les emails et appels effectués sont enregistrés manuellement.

L’adaptateur de découverte utilise l’API Géo et l’API Recherche d’entreprises,
uniquement après activation de la source dans les paramètres. Les codes NAF sont
facultatifs : ceux saisis ont priorité ; sinon un catalogue de métiers courants
propose le filtre. Si une activité n’est pas reconnue, la recherche géographique
inclut toutes les activités et un avertissement est affiché. Les établissements ouverts
dans la zone sont rapprochés de leur entreprise ; les SIREN et l’identité évitent
les doublons. Les sites, emails et téléphones ne sont jamais inventés.

### Sites et Google Business Profile

Sans clé, les fiches proposent des recherches manuelles Google et Google Maps.
Pour automatiser :

1. Créez un projet Google Cloud et activez **Places API (New)** avec la facturation.
2. Créez une clé restreinte à cette API et, en production, aux IP du serveur.
3. Ajoutez `GOOGLE_PLACES_API_KEY` à `.env.local` ou à l’environnement de production.
   Ne publiez jamais cette clé et n’utilisez pas le préfixe `NEXT_PUBLIC_`.
4. Redémarrez l’application. Dans **Paramètres → Vos connexions**, activez
   **Sites et fiches Google**, puis enregistrez.

Chaque nouveau prospect unique est recherché par nom, adresse et ville (au plus
trois appels simultanés). Les appels consomment le quota Google et peuvent être
facturés. Seule une correspondance unique de nom, ville et adresse renseigne les
liens automatiquement ; l’entreprise reste à examiner. Les autres propositions
peuvent être consultées et sélectionnées depuis la fiche, puis enregistrées.
Un échec Google ne bloque pas l’import des entreprises. Aucun résultat ne vaut
preuve d’absence de site ou de fiche Google. Les liens existants sont conservés.
Les liens vers les audits SEO sont renseignés manuellement et inclus dans les exports.

Documentation : [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search).

### Recherche web avec OpenAI

Créez une clé de projet dans [OpenAI Platform](https://platform.openai.com/api-keys),
configurez la facturation API, puis ajoutez `OPENAI_API_KEY` dans `.env.local` ou
l’environnement de production. `OPENAI_MODEL` choisit le modèle compatible
Responses, recherche web et sorties structurées (`gpt-4.1-mini` par défaut).
Gardez la clé privée côté serveur et redémarrez l’application. L’abonnement
ChatGPT et la facturation de l’API sont distincts.

Dans **Paramètres → Vos connexions**, activez **Recherche avec OpenAI** et réglez
le nombre de prospects analysés par lot (1–5, 3 par défaut), puis enregistrez.
Une recherche web accompagne alors la découverte des nouveaux prospects.
Les autres prospects peuvent être recherchés depuis **Rechercher avec l’IA**
dans leur fiche. Google Places et OpenAI fonctionnent indépendamment.

L’IA reçoit uniquement l’identité professionnelle (nom, activité, ville, adresse,
SIREN et site connu) ; les notes et coordonnées personnelles ne sont pas envoyées.
Elle propose une synthèse, un site et une fiche Google avec des sources cliquables.
Les URL absentes des sources retournées par l’outil de recherche sont éliminées.
Les propositions sont conservées séparément et s’appliquent après sélection
manuelle, sans écraser les liens existants ni qualifier automatiquement le prospect.
Les analyses sont incluses dans les sauvegardes JSON et les exports CSV.
Une erreur ou un quota insuffisant n’empêche pas l’import des entreprises.
Chaque appel est limité à 25 secondes, 6 000 tokens de sortie et deux appels
d’outil par prospect ; les tokens et recherches web sont facturés par OpenAI.

Documentation : [Recherche web](https://developers.openai.com/api/docs/guides/tools-web-search)
et [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Organisation et vérifications

`app` contient les routes ; `components` les écrans et composants ; `lib/domain`
les schémas et règles métier ; `lib/server` l’authentification, la base et la recherche.
`scripts` contient l’initialisation et les contrôles ; `tests` utilise des données
fictives internes et une base temporaire. Ces données ne sont pas accessibles
par une route et ne sont pas insérées dans la base du projet.

Toutes les sauvegardes privées passent par la base SQL, avec validation serveur
et numéro de révision pour refuser les écrasements entre onglets. Le stockage
métier est actuellement un instantané JSON par compte dans une table PostgreSQL,
aux côtés des tables relationnelles BetterAuth. Il pourra être normalisé lorsque
les volumes et les automatisations le justifieront.

```bash
npm run types
npm run lint
npm run test
npm run check:lines
npm run format:check
npm run build
```

Tous les fichiers source restent sous 500 lignes. Les tests de stockage sont
exécutés sous SQLite ; l’intégration PostgreSQL nécessite la base dédiée réelle.
Le lockfile conserve les dépendances natives des plateformes Linux attendues
par le générateur. Les alertes npm de la chaîne ESLint héritée du starter sont
limitées aux dépendances de développement (`npm audit --omit=dev` est propre).

L’envoi automatique, les tâches IA planifiées, BullMQ/Redis et l’intégration SEO restent dans
les phases ultérieures du cadrage. Aucun déploiement sur le VPS n’a été exécuté
pendant la préparation du projet et du formulaire.
