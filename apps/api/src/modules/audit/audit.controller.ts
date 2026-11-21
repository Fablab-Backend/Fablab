import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './audit.validation';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMINISTRATEUR)
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll(query);
  }
}
