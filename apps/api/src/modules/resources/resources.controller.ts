import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateRoomDto, CreateEquipmentDto } from './resources.validation';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // Route pour créer une salle
  // @UseGuards(AuthGuard) @Roles('Responsable') <-- À décommenter quand Melvin a fini
  @Post('rooms')
  createRoom(@Body() createRoomDto: CreateRoomDto) {
    return this.resourcesService.createRoom(createRoomDto);
  }

  // Route pour créer un équipement
  @Post('equipments')
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
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.resourcesService.update(id, updateData);
  }

  // Route pour supprimer
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}