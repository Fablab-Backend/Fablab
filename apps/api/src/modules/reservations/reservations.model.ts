import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export type ReservationDocument = Reservation & Document;

@Schema({ timestamps: true, collection: 'reservations' })
export class Reservation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Resource', required: true })
  resourceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  startTime!: Date;

  @Prop({ required: true })
  endTime!: Date;

  @Prop({ type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING })
  status!: ReservationStatus;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
// Empêche les doublons exacts au niveau de la base de données
ReservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 }, { unique: true });