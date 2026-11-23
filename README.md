# Plateforme FabLab

Plateforme de réservation de salles et de prêt de matériel pour FabLab.

Monorepo npm workspaces :

| Chemin               | Contenu                                                        |
| -------------------- | -------------------------------------------------------------- |
| `apps/api`           | API backend — Node.js, NestJS, MongoDB (Mongoose)              |
| `apps/web`           | Frontend React (squelette, voir `apps/web/README.md`)          |
| `packages/shared`    | Types et constantes partagés entre front et back               |
| `infra`              | Infrastructure (Docker, Nginx, Compose)                        |
| `docs`               | Documentation                                                  |

## Prérequis

- **Node.js** >= 20 (voir `.nvmrc`)
- **npm** >= 9
- **MongoDB** accessible (instance locale ou distante)

## Installation

```bash
# Depuis la racine du monorepo
npm install
```

Toutes les dépendances des workspaces (`apps/*`, `packages/*`) sont installées en une seule commande.

## Configuration

Créer le fichier `.env` à la racine du projet à partir du modèle :

```bash
cp .env.example .env
```

| Variable          | Description                                            | Obligatoire | Défaut                        |
| ----------------- | ------------------------------------------------------ | ----------- | ----------------------------- |
| `NODE_ENV`        | Environnement d'exécution (`development`, `production`)| Non         | `development`                 |
| `PORT`            | Port HTTP de l'API                                     | Non         | `3000`                        |
| `MONGODB_URI`     | URI de connexion MongoDB                               | Oui         | `mongodb://localhost:27017/fablab` |
| `JWT_SECRET`      | Secret de signature des jetons JWT                     | **Oui**     | —                             |
| `JWT_EXPIRES_IN`  | Durée de vie d'un jeton JWT                            | Non         | `8h`                          |
| `REDIS_URL`       | URL Redis (verrou des jobs planifiés ; sans Redis, les jobs sont sautés) | Non         | —                             |
| `AI_API_KEY`      | Clé API pour le module chatbot                         | Non         | —                             |
| `SMTP_HOST`       | Hôte SMTP (notifications e-mail)                       | Non         | —                             |
| `SMTP_USER`       | Utilisateur SMTP                                        | Non         | —                             |
| `SMTP_PASS`       | Mot de passe SMTP                                       | Non         | —                             |
| `MAIL_FROM`       | Adresse d'expédition des e-mails                        | Non         | —                             |
| `LOAN_MAX_DAYS`   | Durée maximale d'un prêt (jours)                        | Non         | `14`                          |

> **Sécurité** : ne jamais committer le fichier `.env` ni aucune valeur secrète.
> `JWT_SECRET` doit être une chaîne longue et aléatoire, différente par environnement.

## Démarrage de l'API

L'API est exposée sous le préfixe global `/api` (port `3000` par défaut).

```bash
# Mode développement (watch) — depuis la racine
npm run start:dev --workspace @fablab/api

# Équivalent depuis apps/api
cd apps/api && npm run start:dev

# Mode production (nécessite un build préalable)
npm run build --workspace @fablab/api
npm run start:prod --workspace @fablab/api
```

L'API répond alors sur `http://localhost:3000/api`.

## Tests

Les tests unitaires utilisent le runner natif **`node:test`** de Node.js (aucun framework externe).

```bash
# Depuis la racine du monorepo — exécute les 16 fichiers *.test.ts de apps/api
npm test

# Équivalent
npm run test --workspace @fablab/api
```

> Les tests s'exécutent via `ts-node` et nécessitent que la commande soit lancée
> avec `apps/api` comme répertoire de travail (c'est le cas des scripts npm ci-dessus),
> afin que `apps/api/tsconfig.json` soit pris en compte.

## Modules métier

L'API est organisée en modules NestJS sous `apps/api/src/modules` :

| Module            | Rôle                                                        |
| ----------------- | ----------------------------------------------------------- |
| `auth`            | Connexion JWT, session, garde d'authentification            |
| `users`           | Comptes utilisateurs, profils, changement de mot de passe   |
| `admin`           | Statistiques, paramètres de la plateforme                   |
| `audit`           | Journal des actions sensibles (`auditLogs`)                 |
| `resources`       | Ressources du FabLab : salles et équipements (modèle discriminé) |
| `reservations`    | Réservation des salles et des équipements                  |
| `availability`    | Disponibilités et créneaux                                  |
| `loans`           | Prêts de matériel (durée max configurable via `LOAN_MAX_DAYS`) |
| `locations`       | Sites et localisation des ressources                        |
| `organizations`   | Organisations / structures utilisatrices                    |
| `files`           | Upload de fichiers (Multer) et métadonnées associées        |
| `notifications`   | Notifications (e-mail via SMTP, journal des événements)     |
| `chatbot`         | Assistant conversationnel (intégration LLM, `AI_API_KEY`)   |
| `collaboration`   | Fonctionnalités collaboratives                              |

Chaque module suit la structure standard NestJS : `*.module.ts`, `*.controller.ts`,
`*.service.ts`, `*.model.ts`, `*.validation.ts` et `*.test.ts`.

## Infrastructure

`infra/` contient la configuration de déploiement :

- `compose.yaml` — MongoDB 7 et Redis 7 en conteneurs (volume `mongo_data`)
- `docker/` — Dockerfiles de l'API et du frontend
- `nginx/` — configuration du reverse proxy
- `deploy/` — scripts et fichiers de déploiement

```bash
# Démarrer MongoDB et Redis localement
docker compose -f infra/compose.yaml up -d
```

## Documentation

- `docs/` — documentation fonctionnelle par module (`loans.md`, `notifications.md`, …)
- `packages/shared` — types et constantes partagés entre le front et le back

## Rôles et autorisations

Trois rôles officiels, définis dans `packages/shared` et `apps/api/src/common/enums/user-role.enum.ts` :

- **`Utilisateur`** — rôle par défaut à la création d'un compte.
- **`Responsable`** — gestion des ressources et des réservations.
- **`Administrateur`** — gestion des comptes, des rôles, des paramètres et du journal d'audit.

Mécanismes de sécurité :

- Authentification par **JWT** (`Authorization: Bearer <token>`), avec vérification en base que le compte est actif à chaque requête.
- `JwtAuthGuard` et `RolesGuard` appliqués **globalement** ; les routes publiques sont marquées `@Public()` (`/api/auth/login`, `/api/health`).
- Les restrictions de rôle utilisent `@Roles(...)`.
- Les mots de passe sont hachés avec **bcrypt** et jamais exposés par l'API.
- Toutes les entrures sont validées (`class-validator` + `ValidationPipe` global).
- Les erreurs suivent un format uniforme (`statusCode`, `message`, `error`, `path`, `timestamp`).

### Authentification et session

> **Important — déconnexion** : `POST /api/auth/logout` enregistre l'action
> `auth.logout` dans le journal d'audit, mais **ne révoque pas le jeton JWT**.
> Le token reste valide jusqu'à son expiration (`JWT_EXPIRES_IN`). Il n'existe
> pas encore de blacklist ni de session serveur.

## Routes API

| Méthode | Route                      | Accès                 | Description                                |
| ------- | -------------------------- | --------------------- | ------------------------------------------ |
| GET     | `/api/health`              | Public                | État de l'API et de la connexion MongoDB   |
| POST    | `/api/auth/login`          | Public                | Connexion → `{ accessToken, tokenType, user }` |
| POST    | `/api/auth/logout`         | Authentifié           | Déconnexion (journalisée, voir ci-dessus)  |
| GET     | `/api/me`                  | Authentifié           | Profil de l'utilisateur connecté           |
| GET     | `/api/users`               | Administrateur        | Liste paginée des utilisateurs             |
| POST    | `/api/users`               | Administrateur        | Création d'un compte                       |
| GET     | `/api/users/:id`           | Administrateur        | Détail d'un utilisateur                    |
| GET     | `/api/users/me`            | Authentifié           | Son propre profil                          |
| PATCH   | `/api/users/me`            | Authentifié           | Modifier son profil (nom, téléphone, etc.) |
| PATCH   | `/api/users/me/password`   | Authentifié           | Changer son mot de passe                   |
| PATCH   | `/api/users/:id`           | Administrateur        | Modifier rôle, activation, profil          |
| GET     | `/api/audit-logs`          | Administrateur        | Journal des actions (filtres, pagination)  |
| GET     | `/api/admin/stats`         | Administrateur        | Statistiques de la plateforme              |
| GET     | `/api/admin/settings`      | Administrateur        | Paramètres de configuration                |
| PUT     | `/api/admin/settings`      | Administrateur        | Mise à jour des paramètres                 |
| GET     | `/api/resources`           | Authentifié           | Liste des ressources (salles et équipements, avec filtres) |
| GET     | `/api/resources/:id`       | Authentifié           | Détail d'une ressource                     |
| POST    | `/api/resources/rooms`     | Responsable, Admin    | Créer une salle                            |
| POST    | `/api/resources/equipments`| Responsable, Admin    | Créer un équipement                        |
| PATCH   | `/api/resources/:id`       | Responsable, Admin    | Modifier une ressource                     |
| DELETE  | `/api/resources/:id`       | Responsable, Admin    | Supprimer une ressource                    |
| GET     | `/api/loans`               | Authentifié           | Liste des prêts (un utilisateur ne voit que les siens) |
| POST    | `/api/loans`               | Authentifié           | Créer un prêt (voir `docs/loans.md`)       |
| POST    | `/api/loans/:id/return`    | Responsable, Admin    | Enregistrer le retour d'un prêt            |
| GET     | `/api/notifications`       | Authentifié           | Notifications de l'utilisateur connecté (pagination, `unreadOnly`) |
| POST    | `/api/chatbot/message`     | Authentifié           | Envoyer un message au chatbot (`{ message }`, 1 à 500 caractères, 10 messages/minute max) |
| POST    | `/api/files/upload`        | Responsable, Admin    | Upload d'un fichier (multipart)            |
| GET     | `/api/organizations`       | Authentifié           | Liste des organisations                    |
| GET     | `/api/organizations/:id`   | Authentifié           | Détail d'une organisation                  |
| POST    | `/api/organizations`       | Administrateur        | Créer une organisation                     |

> **Routes pas encore exposées** : les modules `reservations`, `availability`,
> `locations` et `collaboration` ont leur logique métier (services, modèles, tests)
> mais **aucun contrôleur** pour l'instant, donc aucune route HTTP. Le front ne peut
> pas les appeler tant que les contrôleurs ne sont pas écrits côté back.

### Exemples

```bash
# Connexion
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<mot-de-passe>"}'

# Utilisateur connecté
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer <accessToken>"

# Santé de l'API
curl http://localhost:3000/api/health
```

## Guide d'intégration pour l'équipe frontend

Cette section explique comment connecter `apps/web` à l'API. La liaison est faite par
l'équipe front ; l'équipe back fournit l'API et ce guide.

### 1. Lancer le back en local

```bash
npm install                                     # à la racine
cp .env.example .env                            # puis renseigner JWT_SECRET
docker compose -f infra/compose.yaml up -d      # MongoDB (et Redis, optionnel)
ADMIN_EMAIL=admin@example.org ADMIN_PASSWORD='<mot-de-passe-fort>' \
  node apps/api/scripts/seed-admin.js           # crée le compte administrateur
npm run start:dev                               # API sur http://localhost:3000/api
```

Vérifier que l'API répond : `curl http://localhost:3000/api/health`.

### 2. Configurer l'URL de l'API

Ne pas écrire l'URL en dur dans le code. Utiliser une variable d'environnement dans
`apps/web/.env`. Le nom et la façon de la lire dépendent de l'outil de build du front :

| Outil                | Variable                                      | Lecture dans le code                    |
| -------------------- | --------------------------------------------- | --------------------------------------- |
| Vite                 | `VITE_API_URL=http://localhost:3000/api`      | `import.meta.env.VITE_API_URL`          |
| Create React App     | `REACT_APP_API_URL=http://localhost:3000/api` | `process.env.REACT_APP_API_URL`         |
| Next.js              | `NEXT_PUBLIC_API_URL=http://localhost:3000/api` | `process.env.NEXT_PUBLIC_API_URL`     |

> Seules les variables avec ces préfixes (`VITE_`, `REACT_APP_`, `NEXT_PUBLIC_`) sont
> visibles dans le navigateur. Redémarrer le serveur de développement après toute
> modification du `.env`.

**Si le front passe par un serveur Node.js** (Express, Next.js côté serveur…) : le
navigateur n'est alors plus obligé d'appeler l'API directement. Le serveur du front peut
relayer les requêtes vers `http://localhost:3000/api` (proxy). Cela évite les soucis de
CORS, mais le principe reste identique : l'API attend toujours l'en-tête
`Authorization: Bearer <accessToken>`. Le JWT reste celui renvoyé par `/api/auth/login`.

Pour éviter le CORS en développement sans écrire de serveur, un proxy suffit :
`server.proxy` dans `vite.config.ts`, ou `"proxy": "http://localhost:3000"` dans le
`package.json` de Create React App. Le front appelle alors `/api/...` sur son propre port.

Toutes les routes sont sous le préfixe `/api`. Le CORS est actuellement ouvert à toutes
les origines (`enableCors()`) : le front peut tourner sur un autre port (ex. `5173`).
Il sera restreint à l'adresse du front en production.

### 3. S'authentifier

1. `POST /api/auth/login` avec `{ "email": "...", "password": "..." }`.
2. La réponse contient `{ accessToken, tokenType, user }`. Conserver `accessToken`.
3. Envoyer l'en-tête `Authorization: Bearer <accessToken>` sur toutes les autres routes
   (seules `/api/auth/login` et `/api/health` sont publiques).
4. `GET /api/me` renvoie l'utilisateur connecté, avec son rôle, pour adapter l'interface.

Le jeton expire après `JWT_EXPIRES_IN` (8 h par défaut). Au-delà, l'API répond 401 :
renvoyer l'utilisateur vers la page de connexion. La déconnexion supprime le jeton côté
front (le back ne le révoque pas, voir plus haut).

### 4. Client HTTP conseillé

Créer un client unique dans `apps/web/src/lib/` qui ajoute le jeton à chaque requête et
traite les erreurs au même endroit :

```ts
// Adapter la lecture de la variable à l'outil de build (voir le tableau ci-dessus)
const API = import.meta.env.VITE_API_URL; // Vite

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
  if (!res.ok) throw await res.json(); // { statusCode, message, error, path, timestamp }
  return res.json();
}
```

> Pour l'upload de fichier (`/api/files/upload`), envoyer un `FormData` et **ne pas**
> fixer l'en-tête `Content-Type` : le navigateur ajoute lui-même la limite multipart.

### 5. Règles à respecter

- **Données strictes** : l'API refuse (400) tout champ non prévu dans le corps d'une
  requête. N'envoyer que les champs documentés.
- **Pagination** : les listes d'utilisateurs, de prêts, de notifications et du journal
  d'audit acceptent `page` (défaut `1`) et `limit` (défaut `20`). `GET /api/resources`
  n'est pas paginée.
- **Format d'erreur** : `{ statusCode, message, error, path, timestamp }`. `message` peut
  être un tableau de chaînes quand plusieurs champs sont invalides.
- **Codes à gérer** : `400` données invalides, `401` non connecté ou jeton expiré,
  `403` rôle insuffisant, `404` introuvable, `409` conflit (ex. prêt déjà retourné),
  `429` trop de messages au chatbot.
- **Rôles** : `Utilisateur`, `Responsable`, `Administrateur`. Masquer dans l'interface les
  actions interdites, mais ne pas s'y fier : l'API vérifie toujours le rôle.
- **Types partagés** : réutiliser les rôles et constantes de `packages/shared` plutôt que
  de les redéfinir (`import { ... } from '@fablab/shared'`).
- **Chatbot** : le chatbot propose d'ouvrir un formulaire de réservation mais ne réserve
  jamais lui-même ; la confirmation passe par l'interface.

### 6. Tester sans le front

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<mot-de-passe>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl http://localhost:3000/api/resources -H "Authorization: Bearer $TOKEN"
```

## Création du compte administrateur

Un script de seed crée le **premier** compte `Administrateur` (idempotent : il ne touche à rien si le compte existe déjà) :

```bash
node apps/api/scripts/seed-admin.js
```

Les identifiants sont **configurés par variables d'environnement** — ne pas les laisser dans le code ni dans le README :

| Variable             | Description              |
| -------------------- | ------------------------ |
| `ADMIN_EMAIL`        | Adresse e-mail du compte |
| `ADMIN_PASSWORD`     | Mot de passe initial     |
| `ADMIN_FIRST_NAME`   | Prénom                  |
| `ADMIN_LAST_NAME`    | Nom                     |

Exemple :

```bash
ADMIN_EMAIL=admin@example.org ADMIN_PASSWORD='<mot-de-passe-fort>' \
  node apps/api/scripts/seed-admin.js
```

> **Important** : le mot de passe initial doit être choisi par vous, être long et
> unique, puis **changé après la première connexion**. Ne partagez jamais ces
> identifiants et ne les committez pas.

## Journalisation (audit)

La collection MongoDB `auditLogs` enregistre les actions sensibles :

`auth.login`, `auth.login_failed`, `auth.logout`, `user.created`, `user.updated`,
`user.password_changed`, `settings.updated`

Chaque entrée contient `userId`, `action`, `resourceType`, `resourceId`,
`details` et `ip`. Consultation via `GET /api/audit-logs` (Administrateur).