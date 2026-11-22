# Module Resources (Ressources)

Ce module gère les ressources de la plateforme, qui peuvent être de deux types : des **Salles** (`Room`) ou des **Équipements** (`Equipment`). Il utilise les `discriminators` de Mongoose pour stocker les deux types dans la même collection `resources` tout en gardant leurs champs spécifiques.

## Modèle de données (`resources`)

Champs communs :
- `name` (string, requis) : Nom de la ressource.
- `description` (string, optionnel) : Description.
- `locationId` (ObjectId, optionnel) : Référence vers le module `locations`.
- `isActive` (boolean) : Statut d'activation.

Champs spécifiques aux **Salles** (`type: "Room"`) :
- `capacity` (number, requis) : Capacité d'accueil (utilisé par le module `reservations`).
- `roomNumber` (string, optionnel) : Numéro de la salle.

Champs spécifiques aux **Équipements** (`type: "Equipment"`) :
- `inventoryNumber` (string, requis) : Numéro d'inventaire unique.
- `state` (string, requis) : État du matériel (`available`, `broken`, `maintenance`). *Crucial pour le module `loans` de Win_ner.*

## Routes de l'API

- `GET /api/resources` : Récupère la liste de toutes les ressources.
  - *Filtres disponibles (Query params)* : `?type=Room`, `?locationId=xxx`, `?minCapacity=10`, `?state=available`.
- `GET /api/resources/:id` : Récupère une ressource par son ID.
- `POST /api/resources/rooms` : Crée une nouvelle salle.
- `POST /api/resources/equipments` : Crée un nouvel équipement.
- `PATCH /api/resources/:id` : Modifie une ressource existante.
- `DELETE /api/resources/:id` : Supprime une ressource.

## TODO (Intégrations futures)
- [ ] Ajouter les Guards `AuthGuard` et `Roles('Responsable')` (en attente de Melvin).
- [ ] Ajouter les logs d'audit dans le service (en attente de l'AuditService de Melvin).