import { Controller, Get, Param, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('resources/:id/availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  getAvailability(
    @Param('id') resourceId: string,
    @Query('date') date: string,
  ) {
    // Si aucune date n'est fournie, on prend aujourd'hui
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.availabilityService.getAvailability(resourceId, targetDate);
  }
}