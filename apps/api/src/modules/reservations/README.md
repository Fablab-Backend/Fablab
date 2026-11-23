# Module Réservations

Ce module gère la création, la modification et l'annulation des réservations de ressources (salles/équipements).

## Routes disponibles
- `POST /api/reservations` : Créer une réservation (Authentifié). Vérifie les conflits de créneaux.
- `GET /api/reservations` : Lister les réservations.
- `GET /api/reservations/:id` : Voir une réservation.
- `POST /api/reservations/:id/cancel` : Annuler une réservation.

## Règles métier importantes
- **Anti-conflit** : Impossible de réserver un créneau déjà pris (vérification stricte des dates de début et de fin + index unique en base).
- **Événement** : Émet un événement `reservation.created` à la création (via `eventemitter2`).

## Exemple de Payload (POST)
```json
{
  "resourceId": "ID_DE_LA_SALLE",
  "startTime": "2026-11-25T10:00:00.000Z",
  "endTime": "2026-11-25T12:00:00.000Z"
}