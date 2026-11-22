import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './organizations.validation';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.ADMINISTRATEUR)
  create(@Body() createOrgDto: CreateOrganizationDto) {
    return this.orgService.create(createOrgDto);
  }

  @Get()
  findAll() {
    return this.orgService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgService.findOne(id);
  }
}