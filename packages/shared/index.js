'use strict';

/**
 * Rôles officiels de la plateforme FabLab.
 * Toute valeur liée au rôle d'un utilisateur doit utiliser ces constantes.
 */
const UserRole = Object.freeze({
  UTILISATEUR: 'Utilisateur',
  RESPONSABLE: 'Responsable',
  ADMINISTRATEUR: 'Administrateur',
});

module.exports = { UserRole };
