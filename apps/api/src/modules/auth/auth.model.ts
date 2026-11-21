import { UserRole } from '../../common/enums/user-role.enum';

/** Charge utile signée dans le JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Utilisateur authentifié exposé aux guards et contrôleurs. */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}

/** Corps de la réponse de POST /api/auth/login. */
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}
