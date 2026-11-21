import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './auth.validation';
import { JwtPayload, LoginResponse } from './auth.model';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<LoginResponse> {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );

    if (!user) {
      await this.auditService.log({
        action: 'auth.login_failed',
        resourceType: 'auth',
        details: { email: dto.email.toLowerCase() },
        ip,
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      userId: user._id.toString(),
      action: 'auth.login',
      resourceType: 'auth',
      resourceId: user._id.toString(),
      details: { email: user.email },
      ip,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: this.usersService.toPublic(user) as LoginResponse['user'],
    };
  }

  async logout(userId: string, ip?: string): Promise<{ message: string }> {
    await this.auditService.log({
      userId,
      action: 'auth.logout',
      resourceType: 'auth',
      resourceId: userId,
      ip,
    });
    return { message: 'Déconnexion effectuée' };
  }

  getSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET n\'est pas configuré');
    }
    return secret;
  }
}
