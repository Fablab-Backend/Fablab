import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './reservations.validation';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  create(@Body() createDto: CreateReservationDto, @Req() req: any) {
    // On suppose que le guard JWT met l'utilisateur dans req.user
    const userId = req.user?.userId || req.user?._id; 
    return this.reservationsService.create(createDto, userId);
  }

  @Get()
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.reservationsService.cancel(id);
  }
}