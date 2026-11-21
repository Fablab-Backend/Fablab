import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.validation';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/users.model';
import { LoginResponse } from './auth.model';

/** Route globale GET /api/me — utilisateur connecté. */
@Controller()
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return this.usersService.toPublic(user);
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string): Promise<LoginResponse> {
    return this.authService.login(dto, ip);
  }

  @Post('logout')
  logout(@CurrentUser() user: UserDocument, @Ip() ip: string) {
    return this.authService.logout(user._id.toString(), ip);
  }
}
