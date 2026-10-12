# Sillage · Prospection 404NotFood

Application personnelle de prospection, réalisée à partir de `../CADRAGE.md`.
Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui, Magic UI et BetterAuth.

## Démarrage local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Sans configuration d’authentification, l’accueil
redirige vers `/demo` : 24 entreprises fictives, trois campagnes et des exemples
de prestations. Les essais sont enregistrés uniquement dans le navigateur.
Les données de démonstration ne sont jamais insérées dans la base privée.

## Créer le compte privé

1. Copier `.env.example` vers `.env.local`.
2. Définir `BETTER_AUTH_URL` avec l’URL exacte de l’application.
3. Générer `BETTER_AUTH_SECRET` avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Choisir le stockage : SQLite par défaut en développement ; PostgreSQL via
   `DATABASE_URL` pour le VPS. Ne pas réutiliser la base du projet SEO.
5. Fournir `OWNER_PASSWORD` dans l’environnement du terminal, puis lancer
   `npm run account:setup`. Le script demande l’adresse email, crée les tables
   BetterAuth et le compte. Le mot de passe doit avoir au moins 12 caractères.
6. Effacer `OWNER_PASSWORD` de l’environnement après le setup, puis redémarrer
   le serveur si la configuration a changé.

Exemple PowerShell pour saisir le mot de passe sans l’afficher :

```powershell
$ownerSecurePassword = Read-Host 'Mot de passe du compte privé' -AsSecureString
$env:OWNER_PASSWORD = [System.Net.NetworkCredential]::new('', $ownerSecurePassword).Password
npm run account:setup
Remove-Item Env:OWNER_PASSWORD
```

L’inscription publique est désactivée dans l’application. Seul le script local
permet de créer un compte. Aucune valeur de secret ni aucun identifiant réel
n’est préinstallé. `/connexion` affiche la marche à suivre tant que le secret
n’est pas configuré ; un secret configuré nécessite aussi les tables et le compte.

## Parcours de la V1

- Vue d’ensemble : compteurs calculés, campagnes et derniers échanges.
- Campagnes : configuration en trois étapes, critères, prestation, modèle,
  taille du lot, pause et reprise.
- Prospects : recherche, filtres, tri, pagination, sélection et export CSV.
- Fiches : identité, coordonnées, sources, vérifications, notes, statuts,
  relances et opposition à la prospection.
- Qualification : ouverture séquentielle d’un lot. Une entreprise incertaine
  reste à examiner. La sauvegarde conserve chaque vérification effectuée.
- Emails : modèles, variables, aperçu, personnalisation et ouverture de la
  messagerie locale. L’envoi est ensuite consigné manuellement.
- Prestations : tarifs indicatifs, conditions et activation dans les campagnes.
- Paramètres : identité, signature, taille des lots, source et sauvegardes JSON.

Les oppositions bloquent les actions de contact. Un prospect ne peut pas être
qualifié sans date de vérification, faits observés et présence numérique examinée.
Les exports CSV neutralisent les formules pour une ouverture dans un tableur.
Une restauration remplace l’espace courant après une confirmation dans l’interface.
Une sauvegarde marquée comme démonstration est refusée dans l’espace privé.

## Découverte géographique

L’adaptateur optionnel utilise deux sources publiques :

- [API Géo](https://geo.api.gouv.fr/decoupage-administratif/communes) pour la commune et son centre.
- [API Recherche d’entreprises](https://recherche-entreprises.api.gouv.fr/docs/) pour les établissements.

Il reste désactivé tant qu’il n’est pas activé puis enregistré dans les paramètres.
Les appels sont disponibles uniquement dans l’espace authentifié. Renseigner
les codes NAF dans la campagne, une ville complète et un rayon de 1 à 50 km.
Les noms d’activités décrivent la campagne ; les codes NAF déterminent le filtre
réel de la source. Un nom de commune ambigu est refusé.

Chaque clic récupère une page de 1 à 25 entreprises. Seuls les établissements
ouverts correspondant aux codes NAF dans la réponse géographique sont retenus.
Le siège peut être dans une autre ville : il n’est pas utilisé à la place de
l’établissement correspondant. Les SIREN et l’identité normalisée évitent les
doublons, y compris lorsqu’une entreprise a déjà été ajoutée manuellement.

La page suivante est enregistrée avec les données du lot ; si la sauvegarde échoue,
le même lot peut être rejoué sans perdre les résultats précédents. Les résultats
peuvent évoluer entre deux appels : la couverture n’est pas exhaustive.
Un champ web vide reste « À vérifier ». Aucun email, téléphone ou site n’est inventé.
La V1 ne réalise pas d’enrichissement automatique et ne lance pas d’audit SEO.

## Organisation du code

```text
app/                    Routes, layouts, endpoints et métadonnées
components/auth/        Connexion
components/shell/       Navigation, cadre et recherche globale
components/dashboard/   Vue d’ensemble, compteurs et activité
components/campaigns/   Assistant, ciblage et traitement des lots
components/prospects/   Table, fiche, qualification et composition des emails
components/library/     Catalogue et modèles
components/settings/    Paramètres et sauvegardes
components/shared/      Petits composants réutilisables
components/ui/          Sources shadcn/ui et Magic UI adaptées au thème
components/workspace/   État partagé et accès à la persistance
lib/domain/             Types, schémas Zod et règles métier
lib/server/             Authentification, stockage et découverte
scripts/                Création du compte et contrôle des lignes
 tests/                 Tests de qualification, découverte, stockage et auth
```

Tous les fichiers source sont limités à 500 lignes. Les composants des deux espaces
sont partagés ; seules l’origine des données et la méthode de sauvegarde changent.
Les secrets et le stockage restent côté serveur. Les schémas et règles métier sont
vérifiés également sur le serveur avant toute sauvegarde.

Le stockage privé est un instantané JSON validé par compte dans une table SQL,
avec un numéro de révision. Une mise à jour concurrente dans un autre onglet est
refusée plutôt que d’écraser silencieusement les changements. Ce choix simple est
adapté à l’usage individuel initial. Pour un volume plus important, extraire les
entités dans des tables et ajouter des workers durables avant l’automatisation.
Une seule recherche s’exécute à la fois par compte dans le processus Node de la V1.

## Vérifications

```bash
npm run types
npm run lint
npm run test
npm run check:lines
npm run format:check
npm run build
```

Les tests utilisent une base temporaire, des identifiants aléatoires et des réponses
mockées pour la découverte. Ils ne modifient pas les données de l’utilisateur.
Ils vérifient notamment le refus d’inscription publique, une session signée,
l’isolation par compte, les conflits de sauvegarde, les oppositions et le rapprochement
avec le bon établissement local.

L’adaptateur PostgreSQL est fourni mais nécessite une base configurée pour sa
validation d’intégration. Les tests automatisés de stockage tournent sous SQLite.
La chaîne ESLint héritée du starter présente des alertes npm sur `braces` ; aucune
alerte n’apparaît dans `npm audit --omit=dev`. Aucun retour à une ancienne version
de Next.js n’est effectué pour masquer ces alertes.

## Déploiement sur le VPS

Déploiement natif Next.js selon le générateur personnel :

```bash
npm ci
npm run build
npm run start
```

Configurer `BETTER_AUTH_URL` avec le domaine HTTPS public, un secret stable et
`DATABASE_URL` avec une base dédiée. Créer le compte avec le script sur le VPS.
Le serveur utilise une connexion PostgreSQL directe ; le proxy doit transmettre
correctement l’hôte et le protocole. Utiliser un seul processus au départ ; les
limites de recherche sont conservées en mémoire dans chaque processus.
Sauvegarder PostgreSQL régulièrement et garder les secrets hors du dépôt.
En production, SQLite nécessite `SQLITE_PATH` explicite et un volume persistant.

Les emails automatisés, l’agent IA, BullMQ/Redis, l’intégration SEO et les comptes SaaS
restent dans les phases ultérieures du cadrage. Aucun déploiement n’est effectué
par la réalisation locale de cette V1.
"# prospection" 
