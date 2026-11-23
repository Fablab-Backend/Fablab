import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Availability, AvailabilitySchema } from './availability.model';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { Reservation, ReservationSchema } from '../reservations/reservations.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Availability.name, schema: AvailabilitySchema },
      { name: Reservation.name, schema: ReservationSchema }, // On a besoin des réservations pour calculer les dispos
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}