/**
 * Rôles officiels de la plateforme FabLab.
 */
export declare const UserRole: {
  readonly UTILISATEUR: 'Utilisateur';
  readonly RESPONSABLE: 'Responsable';
  readonly ADMINISTRATEUR: 'Administrateur';
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Profil utilisateur exposé par l'API (jamais le hash du mot de passe). */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Charge utile du jeton JWT émis par POST /api/auth/login. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Réponse de POST /api/auth/login. */
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
