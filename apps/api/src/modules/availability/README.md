# Module Disponibilités (Availability)

Ce module permet de calculer et d'exposer les créneaux disponibles pour une ressource spécifique (salle ou équipement).

## Route disponible
- `GET /api/resources/:id/availability?date=YYYY-MM-DD` : Récupère les règles d'ouverture et les créneaux déjà réservés pour une ressource à une date donnée.

*(Note : Si le paramètre `date` n'est pas fourni, le système utilise la date du jour par défaut).*

## Fonctionnement
1. Le service cherche les règles d'ouverture de la ressource pour le jour de la semaine correspondant à la date (ex: Lundi 08:00 - 18:00).
2. Il interroge ensuite le module `reservations` pour trouver toutes les réservations actives (`CONFIRMED` ou `PENDING`) sur cette même journée.
3. Il renvoie les horaires d'ouverture ainsi que la liste des créneaux déjà pris (`bookedSlots`).

## Exemple de réponse
```json
{
  "date": "2026-11-25",
  "openTime": "08:00",
  "closeTime": "18:00",
  "bookedSlots": [
    {
      "start": "2026-11-25T10:00:00.000Z",
      "end": "2026-11-25T12:00:00.000Z"
    }
  ]
}