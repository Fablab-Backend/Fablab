# Module collaboration (annonces et échanges)

Module NestJS (`apps/api/src/modules/collaboration`) pour les annonces
publiées sur une ressource et les messages d'échange entre utilisateurs.
Collections MongoDB `announcements` et `resourceMessages`.

Toutes les routes sont sous le préfixe `/api/collaboration` et protégées par
les guards globaux JWT + rôles.

## Routes

### `GET /api/collaboration/resources/:resourceId/announcements`

Liste les annonces actives d'une ressource. Réservé aux utilisateurs
authentifiés.

- La ressource doit exister et être active (`isActive: true`) → sinon `404` ou `400`.
- Tri : annonces **épinglées d'abord**, puis par date décroissante.

Réponse : `{ items }`.

### `POST /api/collaboration/resources/:resourceId/announcements`

Publie une annonce sur une ressource. Réservé aux rôles `Responsable` et
`Administrateur` (vérifié par `@Roles` **et** par le service → `403` sinon).

```json
{
  "title": "Fermeture exceptionnelle",
  "content": "Le FabLab sera fermé lundi 25 novembre.",
  "pinned": true
}
```

- `title` (requis, ≤ 200 caractères), `content` (requis, ≤ 5000),
  `pinned` (optionnel, défaut `false`).

Réponse : `201` avec l'annonce créée. Erreurs : `400` validation / ressource
désactivée, `403` droits, `404` ressource introuvable.

### `PATCH /api/collaboration/announcements/:id`

Modifie une annonce (titre, contenu, épinglage). Autorisé à **l'auteur** de
l'annonce ou à un rôle privilégié (`Responsable`, `Administrateur`) → sinon
`403`.

```json
{ "title": "Nouveau titre", "pinned": true }
```

Tous les champs sont optionnels. Réponse : l'annonce mise à jour.
Erreurs : `404` annonce introuvable, `403` droits.

### `DELETE /api/collaboration/announcements/:id`

Désactive une annonce (`isActive = false`, suppression logique). Mêmes droits
que le PATCH : auteur ou rôle privilégié → sinon `403`.

Réponse : l'annonce désactivée. Erreurs : `404` introuvable, `403` droits.

### `GET /api/collaboration/resources/:resourceId/messages`

Liste les messages d'une ressource, paginé, **sans les messages supprimés**
(`isDeleted: true` exclus). Tri chronologique croissant.

Paramètres de query :

| Paramètre | Défaut | Description |
| --- | --- | --- |
| `page` | `1` | Page (entier ≥ 1) |
| `limit` | `20` | Taille de page (1–100) |

Réponse : `{ items, total, page, limit }`.

### `POST /api/collaboration/resources/:resourceId/messages`

Poster un message ou répondre à un message racine. Tout utilisateur
authentifié.

```json
{
  "content": "La perceuse est-elle disponible demain ?",
  "parentId": "665f1c2a9b3d4e5f6a7b8c9d"
}
```

- `content` (requis, ≤ 2000 caractères).
- `parentId` (optionnel) : doit pointer vers un message **racine non
  supprimé de la même ressource** — un seul niveau de réponse (répondre à
  une réponse → `400`, parent d'une autre ressource → `400`).

Réponse : `201` avec le message créé. Erreurs : `400` validation / parent
invalide / ressource désactivée, `404` ressource introuvable.

### `DELETE /api/collaboration/messages/:id`

Suppression logique d'un message (`isDeleted = true`). Autorisé à **l'auteur**
ou à un rôle privilégié (`Responsable`, `Administrateur`) → sinon `403`.

Réponse : le message supprimé. Erreurs : `404` introuvable, `403` droits.

## Règles métier

1. **Vérification de la ressource** : avant toute lecture ou création liée à
   une ressource, `ResourcesService.findOne` est appelé → `404` si absente,
   `400` si `isActive: false`.
2. **Rôles** : `PRIVILEGED_ROLES = [Responsable, Administrateur]`, comme dans
   `loans`. Publication d'annonce : uniquement ces rôles. Modification /
   suppression : auteur ou rôle privilégié.
3. **Un seul niveau de réponse** : `parentId` doit référencer un message sans
   `parentId` lui-même, non supprimé, de la même ressource.
4. **Audit** (`AuditService.log`) :
   - `announcement.created` — création d'annonce,
   - `announcement.updated` — modification,
   - `announcement.deleted` — désactivation,
   - `message.deleted` — **uniquement** quand la suppression est faite par un
     modérateur (rôle privilégié autre que l'auteur).
5. **Événements** (`EventEmitter2`, injecté en `@Optional()`) :
   - `announcement.created` — charge l'annonce créée,
   - `message.created` — charge le message créé.

   Le module `realtime/` les diffusera ; aucune notification `notify()` n'est
   appelée en v1 (type et cible à valider avec Winner_Dev).

## Modèles

### `announcements`

| Champ | Type | Description |
| --- | --- | --- |
| `resourceId` | ObjectId → Resource | Ressource concernée |
| `authorId` | ObjectId → User | Auteur |
| `title` | string | Titre (requis) |
| `content` | string | Contenu (requis) |
| `pinned` | boolean | Épinglée en tête de liste (défaut `false`) |
| `isActive` | boolean | Désactivation logique (défaut `true`) |

Index : `{ resourceId: 1, createdAt: -1 }`, `{ resourceId: 1, pinned: -1, createdAt: -1 }`.

### `resourceMessages`

| Champ | Type | Description |
| --- | --- | --- |
| `resourceId` | ObjectId → Resource | Ressource concernée |
| `authorId` | ObjectId → User | Auteur |
| `content` | string | Contenu (requis) |
| `parentId` | ObjectId → ResourceMessage | Message parent (optionnel, un niveau) |
| `isDeleted` | boolean | Suppression logique (défaut `false`) |

Index : `{ resourceId: 1, createdAt: -1 }`, `{ parentId: 1 }`.

## Exemple d'appel

```bash
# Lister les annonces d'une ressource
curl http://localhost:3000/api/collaboration/resources/<resourceId>/announcements \
  -H "Authorization: Bearer <token>"

# Poster un message
curl -X POST http://localhost:3000/api/collaboration/resources/<resourceId>/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Disponible samedi ?"}'
```
