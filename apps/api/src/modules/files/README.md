# Module Files (Fichiers & Documents)

Ce module gère l'upload de fichiers (photos des salles/équipements, documents de prêt). Les fichiers physiques sont stockés dans le dossier `/uploads` à la racine, et leurs métadonnées sont enregistrées dans la collection MongoDB `documents`.

## Modèle de données (`documents`)

- `originalName` (string) : Nom d'origine du fichier.
- `storagePath` (string) : Chemin d'accès local (dans le dossier `/uploads`).
- `mimeType` (string) : Type MIME du fichier (ex: `image/jpeg`).
- `size` (number) : Taille en octets.
- `resourceId` (ObjectId, optionnel) : Lien vers la ressource concernée (utilisant la librairie Multer).

## Routes de l'API

- `POST /api/files/upload` : Permet d'uploader un fichier.
  - **Format attendu** : `multipart/form-data`.
  - **Champs** : 
    - `file` : Le fichier binaire (requis).
    - `resourceId` : L'ID de la ressource à laquelle lier le fichier (optionnel).

## Sécurité et Infrastructure
- Les fichiers sont ignorés par Git via la règle `/uploads` dans le `.gitignore`.
- Le module utilise le `FileInterceptor` de `@nestjs/platform-express`.