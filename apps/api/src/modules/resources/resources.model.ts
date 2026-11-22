import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ResourceDocument = Resource & Document;

@Schema({ timestamps: true, discriminatorKey: 'type' })
export class Resource {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  // Pour rattacher la ressource à un lieu (module Locations)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Location' })
  locationId?: MongooseSchema.Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);

// --- SALLE ---
@Schema()
export class Room extends Resource {
  @Prop({ required: true })
  capacity!: number; // Justin en a besoin pour les réservations
}
export const RoomSchema = SchemaFactory.createForClass(Room);

// --- ÉQUIPEMENT ---
@Schema()
export class Equipment extends Resource {
  @Prop({ required: true })
  inventoryNumber!: string;

  // Win_ner en a besoin pour les prêts
  @Prop({ type: String, enum: ['available', 'broken', 'maintenance'], default: 'available' })
  state!: string; 
}
export const EquipmentSchema = SchemaFactory.createForClass(Equipment);

ResourceSchema.discriminator('Room', RoomSchema);
ResourceSchema.discriminator('Equipment', EquipmentSchema);