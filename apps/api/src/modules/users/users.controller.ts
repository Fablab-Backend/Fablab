import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserQueryDto,
} from './users.validation';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from './users.model';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMINISTRATEUR)
  async findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return this.usersService.toPublic(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMINISTRATEUR)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return this.usersService.toPublic(user);
  }

  @Post()
  @Roles(UserRole.ADMINISTRATEUR)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: UserDocument,
  ) {
    const user = await this.usersService.create(dto, actor._id.toString());
    return this.usersService.toPublic(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(
      user._id.toString(),
      dto,
    );
    return this.usersService.toPublic(updated);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user._id.toString(), dto);
    return { message: 'Mot de passe mis à jour' };
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATEUR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: UserDocument,
  ) {
    const user = await this.usersService.updateByAdmin(
      id,
      dto,
      actor._id.toString(),
    );
    return this.usersService.toPublic(user);
  }
}
