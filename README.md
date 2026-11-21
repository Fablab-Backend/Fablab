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
| `REDIS_URL`       | URL Redis (non utilisé actuellement)                   | Non         | —                             |
| `AI_API_KEY`      | Clé API pour le module chatbot                         | Non         | —                             |
| `SMTP_HOST`       | Hôte SMTP (notifications e-mail)                       | Non         | —                             |
| `SMTP_USER`       | Utilisateur SMTP                                        | Non         | —                             |
| `SMTP_PASS`       | Mot de passe SMTP                                       | Non         | —                             |

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
