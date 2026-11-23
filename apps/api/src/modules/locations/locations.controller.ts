import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './locations.validation';

@Controller('locations') // La route sera bien /api/locations
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // @UseGuards(AuthGuard) @Roles('Responsable') <-- À décommenter plus tard
  @Post()
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  // C'est LA route obligatoire demandée dans ton cahier des charges
  @Get()
  findAll(@Query() query: any) {
    return this.locationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }
}