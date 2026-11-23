import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Availability, AvailabilityDocument } from './availability.model';
import { Reservation, ReservationDocument, ReservationStatus } from '../reservations/reservations.model';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name) private availabilityModel: Model<AvailabilityDocument>,
    @InjectModel(Reservation.name) private reservationModel: Model<ReservationDocument>,
  ) {}

  // Calcule les créneaux libres pour une ressource à une date donnée (ex: '2026-11-24')
  async getAvailability(resourceId: string, dateStr: string) {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

    // 1. Trouver les horaires d'ouverture pour ce jour
    const rules = await this.availabilityModel.findOne({
      resourceId: new Types.ObjectId(resourceId),
      dayOfWeek,
    });

    if (!rules) {
      return { message: 'Aucune règle de disponibilité définie pour ce jour.' };
    }

    // 2. Trouver les réservations existantes pour ce jour
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const reservations = await this.reservationModel.find({
      resourceId: new Types.ObjectId(resourceId),
      status: { $ne: ReservationStatus.CANCELLED },
      startTime: { $lt: endOfDay },
      endTime: { $gt: startOfDay },
    });

    // 3. (Optionnel) Logique pour soustraire les réservations des horaires d'ouverture
    // Pour faire simple, on renvoie les horaires et les créneaux déjà pris
    return {
      date: dateStr,
      openTime: rules.openTime,
      closeTime: rules.closeTime,
      bookedSlots: reservations.map(r => ({ start: r.startTime, end: r.endTime })),
    };
  }
}