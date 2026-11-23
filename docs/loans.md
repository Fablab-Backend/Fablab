# Module loans (prêts de matériel)

Module NestJS (`apps/api/src/modules/loans`) pour le prêt d'équipements
(discriminators `Equipment` du module resources). Collection MongoDB `loans`.

Toutes les routes sont sous le préfixe `/api` et protégées par les guards globaux
JWT + rôles.

## Routes

### `GET /api/loans`

Liste les prêts.

- **Utilisateur** (`Utilisateur`) : uniquement ses propres prêts.
- **Responsable / Administrateur** : tous les prêts.

Paramètres de query :

| Paramètre | Défaut | Description |
| --- | --- | --- |
| `page` | `1` | Page (entier ≥ 1) |
| `limit` | `20` | Taille de page (1–100) |
| `status` | — | `ACTIVE`, `RETURNED` ou `OVERDUE` |
| `equipmentId` | — | Filtrer par équipement |

Réponse : `{ items, total, page, limit }`.

Le `status` renvoyé est le **statut effectif** : un prêt stocké `ACTIVE` dont
`dueAt` est dépassé est exposé comme `OVERDUE`, même si aucune tâche planifiée
n'a encore mis à jour la base.

### `POST /api/loans`

Crée un prêt.

```json
{
  "equipmentId": "665f1c2a9b3d4e5f6a7b8c9d",
  "dueAt": "2026-11-29T10:00:00.000Z",
  "conditionAtLoan": "GOOD",
  "borrowerId": "665f1c2a9b3d4e5f6a7b8c9e",
  "notes": "Emprunt pour le projet X"
}
```

- `equipmentId` (requis) : doit référencer un équipement (`type: 'Equipment'`)
  actif et disponible (`state: 'available'`, `isActive: true`).
- `dueAt` (requis) : date ISO dans le futur, au plus `LOAN_MAX_DAYS` jours
  (variable d'environnement, défaut `14`).
- `conditionAtLoan` (requis) : `GOOD` | `DAMAGED` | `LOST`.
- `borrowerId` (optionnel) : réservé aux rôles `Responsable` et
  `Administrateur` ; sinon l'emprunteur est l'utilisateur connecté (tout autre
  valeur → 403).
- `notes` (optionnel).

Réponse : `201` avec le prêt créé.

Erreurs : `400` validation / équipement invalide, `403` droits,
`404` équipement ou utilisateur introuvable, `409` équipement déjà prêté.

### `POST /api/loans/:id/return`

Enregistre le retour d'un prêt. Réservé aux rôles `Responsable` et
`Administrateur` — un emprunteur ne peut pas clôturer son propre prêt (403).

```json
{
  "conditionAtReturn": "DAMAGED",
  "notes": "Carcasse fissurée"
}
```

- `conditionAtReturn` (requis) : `GOOD` | `DAMAGED` | `LOST`.
- `notes` (optionnel).

La réponse passe le prêt à `RETURNED`, renseigne `returnedAt`,
`conditionAtReturn`, `notes` et `handledBy`. Un retour sur un prêt déjà
`RETURNED` renvoie `409`. Si l'état est `DAMAGED` ou `LOST`, les
responsables/administrateurs sont notifiés.

## Règles métier

1. **Un équipement déjà prêté ne peut pas être emprunté** : un prêt `ACTIVE` ou
   `OVERDUE` existant pour le même `equipmentId` → `409`. La garantie est
   atomique : elle repose sur l'index unique partiel
   `{ equipmentId: 1 }` (filtre `status ∈ {ACTIVE, OVERDUE}`) et l'erreur Mongo
   `11000` est traduite en `409`.
2. La ressource doit exister, être un équipement et être disponible
   (`state: 'available'`, `isActive`) → sinon `404` ou `400`.
3. `dueAt` dans le futur et ≤ `LOAN_MAX_DAYS` (défaut 14 jours).
4. Notifications (`NotificationsService.notify`, jamais bloquantes) :
   `LOAN_CREATED` à l'emprunteur à la création, `LOAN_RETURNED` à l'emprunteur
   au retour, et `LOAN_RETURNED` aux responsables si matériel `DAMAGED`/`LOST`.
5. Audit (`AuditService.log`) : `loan.created` et `loan.returned` avec
   l'utilisateur et l'identifiant du prêt.

## Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `LOAN_MAX_DAYS` | `14` | Durée maximale d'un prêt en jours |

## Exemple d'appel depuis un autre module

```ts
import { LoansService } from '../loans/loans.service';

// LoansModule exporte LoansService : l'importer dans le module appelant.
await this.loansService.create(user, {
  equipmentId,
  dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  conditionAtLoan: 'GOOD',
});
```
