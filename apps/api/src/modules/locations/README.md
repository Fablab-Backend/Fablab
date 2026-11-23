# Module Locations (Lieux)

Ce module gère les lieux physiques (Campus, Bâtiments, Espaces). Chaque lieu est obligatoirement rattaché à une organisation.

## Modèle de données (`locations`)

- `name` (string, requis) : Nom du lieu.
- `type` (string, requis) : Type de lieu (ex: 'Campus', 'Bâtiment', 'Espace').
- `organizationId` (ObjectId, requis) : Référence vers l'organisation propriétaire.

## Routes de l'API

- `GET /api/locations` : **Route obligatoire** listant tous les lieux.
  - *Filtres disponibles* : `?organizationId=xxx`, `?type=Bâtiment`.
- `GET /api/locations/:id` : Récupère un lieu par son ID.
- `POST /api/locations` : Crée un nouveau lieu.

## TODO (Intégrations futures)
- [ ] Protéger la route POST pour qu'elle soit réservée aux Responsables/Administrateurs (en attente de Melvin).