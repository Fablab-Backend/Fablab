# Module Organizations (Organisations)

Ce module gère les organisations ou les établissements (ex: l'école, le Fablab lui-même). C'est la brique racine de l'arborescence des lieux.

## Modèle de données (`organizations`)

- `name` (string, requis) : Nom de l'organisation.
- `description` (string, optionnel) : Informations complémentaires.

## Routes de l'API

- `GET /api/organizations` : Liste toutes les organisations.
- `GET /api/organizations/:id` : Récupère une organisation par son ID.
- `POST /api/organizations` : Crée une nouvelle organisation.

## TODO (Intégrations futures)
- [ ] Protéger la route POST (en attente de Melvin).