import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AvailabilityDocument = Availability & Document;

@Schema({ timestamps: true, collection: 'availabilities' })
export class Availability extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Resource', required: true })
  resourceId!: Types.ObjectId;

  @Prop({ required: true, min: 0, max: 6 })
  dayOfWeek!: number; // 0 = Dimanche, 1 = Lundi, etc.

  @Prop({ required: true }) // ex: "08:00"
  openTime!: string;

  @Prop({ required: true }) // ex: "18:00"
  closeTime!: string;
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);

// Index unique pour éviter les doublons de règles sur un même jour
AvailabilitySchema.index({ resourceId: 1, dayOfWeek: 1 }, { unique: true });