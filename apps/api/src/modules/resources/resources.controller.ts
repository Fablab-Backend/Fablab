import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ResourcesService } from './resources.service';
import { CreateRoomDto, CreateEquipmentDto } from './resources.validation';

// JwtAuthGuard et RolesGuard sont globaux (app.module.ts) : toutes les routes exigent
// un utilisateur connecté, et @Roles restreint l'écriture aux responsables et administrateurs.
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // Route pour créer une salle
  @Post('rooms')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  createRoom(@Body() createRoomDto: CreateRoomDto) {
    return this.resourcesService.createRoom(createRoomDto);
  }

  // Route pour créer un équipement
  @Post('equipments')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  createEquipment(@Body() createEquipmentDto: CreateEquipmentDto) {
    return this.resourcesService.createEquipment(createEquipmentDto);
  }

  // Route pour lister (avec filtres pour le Chatbot)
  @Get()
  findAll(@Query() query: any) {
    return this.resourcesService.findAll(query);
  }

  // Route pour voir le détail d'une ressource
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  // Route pour modifier
  @Patch(':id')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.resourcesService.update(id, updateData);
  }

  // Route pour supprimer
  @Delete(':id')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}