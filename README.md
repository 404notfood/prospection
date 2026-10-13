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

Le profil n’utilise ni Prisma, ni Redis, ni service mail intégré. Un worker Node
effectue les recherches, les vérifications, les brouillons et le suivi des relances.
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

### Réparer des erreurs de chargement après un build

Des erreurs `ChunkLoadError` ou `MODULE_NOT_FOUND` dans `.next/server/chunks`,
avec des fichiers JavaScript renvoyant HTTP 500, indiquent que le serveur ne
retrouve plus les fichiers compilés qu’il attend. Une recompilation dans le
dossier d’un serveur encore actif peut produire ce décalage. Le message MIME
`text/plain` correspond alors à la réponse d’erreur, pas au type des scripts.

Sur le VPS configuré ci-dessus, arrêter le service **avant** de reconstruire :

```bash
sudo systemctl stop prospection &&
sudo -u prospection -H bash -lc 'cd /home/prospection/app && npm run build' &&
sudo systemctl start prospection &&
sudo systemctl --no-pager --full status prospection
```

Le redémarrage a lieu uniquement si le build réussit. Cette procédure conserve
la configuration et les données. Ensuite, recharger complètement le navigateur
avec `Ctrl+F5`. Si le build échoue, corriger son erreur avant de relancer le
service. Si l’erreur persiste après un build réussi et un redémarrage, consulter
`sudo journalctl -u prospection --since "5 minutes ago" --no-pager -n 100`.

Pour les mises à jour dans ce même dossier, arrêter aussi le service avant
`git pull`, `npm ci`, les contrôles et le build, puis démarrer après leur réussite.
Ne pas remplacer ou supprimer `.next` pendant que le service tourne.

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

`npm run dev` et `npm start` lancent le serveur Next.js et son worker.
`tsx` est une dépendance de production du worker. Pour superviser les processus
séparément, lancer Next.js directement et `npm run worker` dans un second service ;
ne pas cumuler ce second service avec le démarrage standard du worker.

### Worker non détecté sur le VPS

Le service généré peut lancer `node .../next start` directement : dans ce cas,
le worker n’est pas démarré. Vérifier avec
`sudo systemctl show prospection -p ExecStart -p WorkingDirectory -p User --no-pager`.
Le point d’entrée `scripts/start.mjs` lance Next.js et le worker avec le même
environnement de production et supervise leurs arrêts.

Le fichier `deploy/prospection-worker.conf` est une surcharge systemd préparée
pour le VPS dont Node est installé dans `/opt/nvm/versions/node/v24.21.0/bin/node`,
avec un serveur sur `127.0.0.1:3000`. Adapter ces chemins et le port si le service
change. Après avoir vérifié que `scripts/start.mjs` est bien déployé :

```bash
sudo install -d -m 0755 /etc/systemd/system/prospection.service.d &&
sudo install -m 0644 /home/prospection/app/deploy/prospection-worker.conf /etc/systemd/system/prospection.service.d/10-worker.conf &&
sudo systemctl daemon-reload &&
sudo systemctl restart prospection
```

Cette modification ne nécessite aucun build. Vérifier ensuite le journal avec
`sudo journalctl -u prospection --since "2 minutes ago" --no-pager -n 50`, puis
actualiser la campagne. Les travaux en attente sont conservés en base et seront
repris. Ne pas lancer un second worker pour résoudre cette alerte si le service
utilise déjà `scripts/start.mjs` : consulter le journal de son échec.

Le lancement autonome `npm run worker` charge la production par défaut ;
`npm run worker:dev` choisit explicitement le développement. Dans le répertoire
de l’application, `npm run worker:check` vérifie la connexion à la base et les
tables de traitements sans lancer de parcours ni signaler un faux worker actif.

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
- Parcours automatique persistant, planification par campagne, pause et reprise.
- Vérifications distinctes du site et de la fiche Google, avec états, dates et sources.
- Qualification des constats suffisamment sourcés ; les cas incertains restent à examiner.
- Brouillons personnalisés enregistrés, catalogue et signature conservés, envoi manuel.
- Rappels de relance après contact manuel, arrêt après réponse, refus ou opposition.
- Modèles d’email, aperçu, personnalisation et ouverture de la messagerie.
- Catalogue : tarifs indicatifs, conditions et disponibilité des prestations.
- Paramètres : identité, signature, source et sauvegardes JSON.

Une qualification exige une date de vérification et des faits observés.
Un champ web vide reste à vérifier. Les oppositions bloquent les contacts.
L’ouverture de la messagerie ne consigne pas automatiquement un envoi.
Les emails et appels effectués sont enregistrés manuellement.

Une nouvelle campagne demande uniquement la ville : le rayon vaut 20 km par
défaut et reste ajustable jusqu’à 50 km. Le nom est généré si vous le laissez
vide. **Créer la campagne** fonctionne dès la première étape ; **Personnaliser**
permet de choisir l’offre, le message et le rythme.

Le mode **Tous les artisans · tous les métiers** est sélectionné par défaut.
L’adaptateur utilise l’API Géo et l’API Recherche d’entreprises après activation
de la source dans les paramètres. Aucun filtre NAF ni déduction de métier par
l’IA n’est appliqué dans ce mode, même si d’anciens champs de ciblage subsistent.
Il parcourt les entreprises actives de la zone, tous métiers confondus. La source
publique peut aussi retourner des commerces ou des services : elle ne garantit
pas une liste exhaustive d’artisans et le statut artisanal reste à vérifier.

**Choisir certains métiers** ouvre les activités et codes NAF facultatifs. Les
codes saisis ont priorité ; sinon un catalogue suggère le filtre. Le parcours
peut résoudre les autres métiers avec l’IA, en exigeant des sources INSEE
effectivement consultées. Une activité non reconnue donne une recherche large
avec un avertissement. Les anciennes campagnes conservent leur ciblage ; les
modifier permet de passer au mode tous métiers.

Les établissements ouverts dans la zone sont rapprochés de leur entreprise ;
les SIREN et l’identité évitent les doublons. La découverte avance par lots et
conserve sa position à l’intérieur d’une page lorsque la limite du parcours est
atteinte. La taille de page de la source reste fixe pour éviter de sauter des
résultats entre les lots. Les sites, emails et téléphones ne sont jamais inventés.

### Cible TPE / PME

Le ciblage **TPE / PME · 30 salariés maximum** est sélectionné par défaut, indépendamment
du choix des métiers. La découverte conserve la catégorie INSEE, la tranche
d’effectif, leurs années de référence et la source pour l’entreprise entière.
Une agence locale de deux salariés d’une entreprise classée GE ne devient donc
pas une TPE. Les catégories GE/ETI et les tranches d’effectif entièrement supérieures à 30 salariés sont
écartés avant import et avant tout appel Google ou OpenAI.

Les entreprises à taille inconnue sont conservées avec **Taille à vérifier**.
La source donne des tranches, pas un effectif exact : **20 à 49 salariés** reste
incertain, car cette tranche chevauche le plafond inclusif de 30 salariés.
Les tranches de 50 salariés et plus sont exclues ; celles jusqu’à 19 salariés
confirment le plafond, sous réserve de la catégorie PME.
Leur qualification, recherche web et brouillon automatiques attendent une
confirmation TPE/PME et du plafond de 30 salariés. Un petit effectif seul ne suffit pas à affirmer une catégorie
PME : la catégorie INSEE tient aussi compte des données financières.

**Traiter les prospects existants** vérifie les anciennes fiches par SIREN auprès
de la source publique avant leurs recherches web. Les grands groupes sont classés
**Hors cible** ; leur historique et leurs anciens brouillons restent conservés,
mais ne sont plus proposés pour l’envoi ou les relances. Ils sont masqués dans
la liste habituelle et accessibles via le filtre **Hors cible**. La fiche propose
aussi **Vérifier la taille** et un lien vers la source. Les exports incluent ces
informations. Aucune liste de noms d’enseignes n’est utilisée. Les métadonnées déjà
enregistrées sont réévaluées avec le plafond actuel, sans redater leur source :
une ancienne PME de 50 salariés ou plus est immédiatement bloquée pour le contact.

Les anciennes campagnes sans ce réglage passent aux TPE/PME et recommencent la
découverte à la première page, sans supprimer les prospects. Un ancien parcours
dont le ciblage a changé se met en pause : l’annuler puis lancer un nouveau
parcours. Le réglage **Toutes les tailles** reste disponible si nécessaire.
L’endpoint géographique ne permet pas de filtrer directement sur la catégorie :
l’application écarte les grandes entreprises au retour et avance dans les pages
selon les limites de la campagne. Un lot peut donc ajouter peu ou aucun prospect
si sa page contient surtout des grands groupes.

Référence : [Catégorie d’entreprise INSEE](https://www.insee.fr/fr/metadonnees/definition/c1057).

### Sites et Google Business Profile

Sans clé, les fiches proposent des recherches manuelles Google et Google Maps.
Pour automatiser :

1. Créez un projet Google Cloud et activez **Places API (New)** avec la facturation.
2. Créez une clé restreinte à cette API et, en production, aux IP du serveur.
3. Dans **Paramètres → Vos connexions → Sites et fiches Google**, collez la clé
   dans le champ **Clé API Google Places**, puis cliquez sur **Enregistrer la clé**.
4. Utilisez **Vérifier la connexion**, puis activez **Sites et fiches Google** et
   enregistrez les paramètres. La vérification effectue une requête Places qui
   utilise votre quota Google. Aucun redémarrage n’est nécessaire après la saisie.

Si la vérification Google échoue, le diagnostic reste affiché sous les boutons.
Il distingue l’API non activée, la facturation, une clé invalide, les restrictions
d’API, de sites web ou d’IP et les quotas. Les appels partent du VPS : autoriser
**Places API (New)** (`places.googleapis.com`) dans le projet de la clé et
restreindre la clé à l’IP publique de sortie du VPS. Une restriction de type
**Sites web** est destinée aux appels du navigateur et ne convient pas ici.
Un timeout ou un échec réseau indique que la clé n’a pas pu être vérifiée.
La clé enregistrée est conservée après un test en erreur. Les réponses Google
brutes, les clés et les identifiants du projet ne sont pas renvoyés au navigateur.

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
configurez la facturation API, puis collez-la dans **Paramètres → Vos connexions →
Recherche avec OpenAI → Clé API OpenAI** et cliquez sur **Enregistrer la clé**.
Le champ **Modèle OpenAI** choisit le modèle compatible Responses, recherche web
et sorties structurées (`gpt-4.1-mini` par défaut). **Vérifier la connexion**
contrôle l’authentification et l’accès au modèle, sans lancer de génération ;
les recherches nécessitent aussi du crédit et les permissions Responses.
L’abonnement ChatGPT et la facturation de l’API sont distincts.

Dans **Paramètres → Vos connexions**, activez **Recherche avec OpenAI** et réglez
le nombre de prospects analysés par lot (1–5, 3 par défaut), puis enregistrez.
Une recherche web accompagne alors la découverte des nouveaux prospects.
Les autres prospects peuvent être recherchés depuis **Rechercher avec l’IA**
dans leur fiche. Google Places et OpenAI fonctionnent indépendamment.

Les clés saisies sont chiffrées en base dans une table distincte des prospects,
avec AES-256-GCM et une clé dérivée de `BETTER_AUTH_SECRET`. Elles sont propres
au compte, ne sont jamais réaffichées et restent exclues des exports JSON/CSV.
Le worker lit les nouvelles valeurs sans redémarrage. Conserver le secret
d’authentification pour restaurer les clés ; après sa rotation, les saisir à
nouveau. Les sauvegardes complètes de la base contiennent les clés chiffrées.
**Supprimer la clé** supprime la valeur du compte et rétablit la clé du serveur
si elle existe. Les variables `OPENAI_API_KEY`, `OPENAI_MODEL` et
`GOOGLE_PLACES_API_KEY` restent une alternative ; leurs modifications nécessitent
un redémarrage. Ne jamais utiliser `NEXT_PUBLIC_` pour une clé secrète.

L’IA reçoit l’identité professionnelle (nom, activité, ville, adresse, SIREN et
site connu) et les faits vérifiés nécessaires à la rédaction ; les notes privées
et les identifiants de connexion ne sont pas envoyés. Elle propose une synthèse,
un site, une fiche Google et les coordonnées professionnelles publiées, avec leurs sources.
Les URL absentes des sources retournées par l’outil de recherche sont éliminées.
Les correspondances certaines s’appliquent sans écraser les informations existantes.
Les propositions incertaines restent visibles à confirmer. La qualification du
parcours exige un résultat daté et sourcé. Une fiche Google sans site renseigné
ne permet pas, à elle seule, de qualifier « aucun site identifié ».
Les analyses sont incluses dans les sauvegardes JSON et les exports CSV.
Une erreur ou un quota insuffisant n’empêche pas l’import des entreprises.
Chaque appel est limité à 25 secondes, 6 000 tokens de sortie et deux appels
d’outil par prospect ; les tokens et recherches web sont facturés par OpenAI.

Documentation : [Recherche web](https://developers.openai.com/api/docs/guides/tools-web-search)
et [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).

## Parcours automatique et brouillons

Dans une campagne active, **Lancer tout le parcours** ajoute un travail durable
à la file SQL. Il découvre les pages suivantes, ignore les doublons, vérifie le
site et la fiche Google, recherche les coordonnées publiées, qualifie les cas
suffisamment vérifiés puis prépare les brouillons des prospects retenus.
**Traiter les prospects existants** réalise les étapes sans nouvelle découverte.
Les fiches jamais traitées ont priorité. Les cas hors cible sont conservés et
signalés, sans les assimiler à un refus de la personne.

Les états du site et de Google sont indépendants : non recherché, trouvé et
confirmé, possible à vérifier, non identifié après recherche, recherche en erreur.
Chaque état conserve sa méthode, sa date et ses sources. « Non identifié »
reste une observation sur les sources consultées, pas une preuve d’inexistence.
Les confirmations humaines et les liens existants sont conservés.

**Planification et limites** configure l’activation, l’intervalle (24 h par
défaut), le nombre de pages (3), les prospects (25) et les tentatives IA (20).
La planification reste désactivée jusqu’à son activation par campagne.
Le plafond quotidien OpenAI, partagé entre toutes les campagnes et actions
manuelles, vaut 50 appels par défaut et se règle dans les paramètres. Le jour
est calculé en Europe/Paris. Les tentatives sont réservées avant l’appel et
ne sont pas remboursées en cas d’erreur, pour ne pas contourner le plafond.
Ces limites portent sur les volumes, pas sur un montant garanti en euros.

Le worker continue sans onglet ouvert. Les étapes terminées sont conservées ;
un bail empêche deux workers de traiter la même tâche. Après un arrêt, le bail
expire et la tâche reprend. Pause et annulation prennent effet entre les
requêtes en cours et avant leur enregistrement. Changer le ciblage interrompt
le parcours : annuler l’ancien et en lancer un nouveau. Une tâche reste en
attente si aucun worker n’est disponible, avec une indication dans l’interface.
Les tables de file et compteurs sont créées automatiquement, sans modifier
les données existantes. Les modifications humaines sont préservées par fusion
des champs et contrôle de révision.

Les brouillons sont disponibles dans les fiches et **Messages → Brouillons
préparés**. L’IA personnalise l’objet et le constat ; l’offre, ses conditions
et son prix indicatif proviennent du catalogue, la signature des paramètres.
Le modèle de campagne reste la base. Si l’IA échoue ou atteint un plafond,
le modèle prépare le brouillon. Aucun envoi ni événement « email envoyé »
n’est enregistré automatiquement. Copier, ouvrir la messagerie et consigner
l’envoi restent des actions manuelles. Après un email ou appel consigné,
une échéance est créée (7 jours par défaut). Une réponse ou un refus stoppe
les rappels. Aucun audit, rapport ou traitement SEO n’est lancé.

Pour vérifier le worker seul sans boucle permanente : `npm run worker -- --once`.
Les tests utilisent une base temporaire et des réponses simulées des fournisseurs.

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

L’envoi automatique et la gestion SEO sont exclus du parcours. Les API réelles,
le rendu navigateur et le comportement PostgreSQL restent à vérifier dans
l’environnement configuré ; aucun déploiement sur le VPS n’a été exécuté ici.
