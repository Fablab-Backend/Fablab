import { Body, Controller, Get, Put } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateSettingsDto } from './admin.validation';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from '../users/users.model';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @Roles(UserRole.ADMINISTRATEUR)
  getStats() {
    return this.adminService.getStats();
  }

  @Get('settings')
  @Roles(UserRole.ADMINISTRATEUR)
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @Roles(UserRole.ADMINISTRATEUR)
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() actor: UserDocument,
  ) {
    return this.adminService.updateSettings(dto, actor._id.toString());
  }
}
