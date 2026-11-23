import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from 'eventemitter2';
import { Reservation, ReservationDocument, ReservationStatus } from './reservations.model';
import { CreateReservationDto } from './reservations.validation';

@Injectable()
export class ReservationsService {
  private eventEmitter = new EventEmitter2();

  constructor(
    @InjectModel(Reservation.name) private reservationModel: Model<ReservationDocument>,
  ) {}

  async create(createDto: CreateReservationDto, userId: string): Promise<Reservation> {
    const start = new Date(createDto.startTime);
    const end = new Date(createDto.endTime);

    if (start >= end) {
      throw new BadRequestException('L\'heure de fin doit être après l\'heure de début.');
    }

    // 🛡️ VÉRIFICATION DES CONFLITS
    const conflict = await this.reservationModel.findOne({
      resourceId: new Types.ObjectId(createDto.resourceId),
      status: { $ne: ReservationStatus.CANCELLED },
      startTime: { $lt: end },
      endTime: { $gt: start }
    });

    console.log('--- RECHERCHE DE CONFLIT ---');
    console.log('Créneau demandé :', start, 'à', end);
    console.log('Conflit trouvé :', conflict ? 'OUI' : 'NON');

    if (conflict) {
      throw new ConflictException('Ce créneau est déjà réservé pour cette ressource.');
    }

    const newReservation = new this.reservationModel({
      resourceId: new Types.ObjectId(createDto.resourceId),
      userId: new Types.ObjectId(userId),
      startTime: start, // On utilise l'objet Date
      endTime: end,     // On utilise l'objet Date
      status: ReservationStatus.CONFIRMED,
    });

    const saved = await newReservation.save();
    this.eventEmitter.emit('reservation.created', saved);

    return saved;
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationModel.find().populate('resourceId').populate('userId').exec();
  }

  async findOne(id: string): Promise<Reservation> {
    const res = await this.reservationModel.findById(id).exec();
    if (!res) throw new NotFoundException('Réservation introuvable');
    return res;
  }

  async cancel(id: string): Promise<Reservation> {
    const res = await this.reservationModel.findByIdAndUpdate(
      id,
      { status: ReservationStatus.CANCELLED },
      { new: true }
    ).exec();
    if (!res) throw new NotFoundException('Réservation introuvable');
    return res;
  }
}