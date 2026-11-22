import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type LocationDocument = Location & Document;

@Schema({ timestamps: true })
export class Location {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  type!: string; // ex: 'Campus', 'Bâtiment', 'Espace'

  // Référence vers l'organisation (module organizations)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Organization', required: true })
  organizationId!: MongooseSchema.Types.ObjectId;
}

export const LocationSchema = SchemaFactory.createForClass(Location);