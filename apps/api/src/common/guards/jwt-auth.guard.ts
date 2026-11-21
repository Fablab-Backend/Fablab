import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsersService } from '../../modules/users/users.service';
import { JwtPayload } from '../../modules/auth/auth.model';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token d\'authentification manquant');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Utilisateur introuvable');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    request.user = user;
    return true;
  }

  private extractToken(request: {
    headers: { authorization?: string };
  }): string | null {
    const header: string | undefined = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
