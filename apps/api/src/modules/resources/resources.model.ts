import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ResourceDocument = Resource & Document;

@Schema({ timestamps: true, discriminatorKey: 'type' })
export class Resource {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  // Référence vers le lieu (locations) - Géré par ton module Locations
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Location' })
  locationId?: MongooseSchema.Types.ObjectId;

  // Optionnel : utile pour désactiver une ressource sans la supprimer
  @Prop({ default: true })
  isActive!: boolean;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);

// ==========================================
// MODÈLE POUR UNE SALLE (ROOM)
// ==========================================
@Schema()
export class Room extends Resource {
  @Prop({ required: true })
  capacity!: number;

  @Prop()
  roomNumber?: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// ==========================================
// MODÈLE POUR UN ÉQUIPEMENT (EQUIPMENT)
// ==========================================
@Schema()
export class Equipment extends Resource {
  @Prop({ required: true })
  inventoryNumber!: string;

  // Le champ 'state' est crucial pour le module de prêt de Win_ner
  @Prop({ 
    type: String, 
    enum: ['available', 'broken', 'maintenance'], 
    default: 'available' 
  })
  state!: string;
}

export const EquipmentSchema = SchemaFactory.createForClass(Equipment);

// ==========================================
// ENREGISTREMENT DES DISCRIMINATEURS
// ==========================================
// Cela permet à Mongoose de stocker les Salles et Équipements 
// dans la même collection 'resources' tout en gardant leurs champs spécifiques.
ResourceSchema.discriminator('Room', RoomSchema);
ResourceSchema.discriminator('Equipment', EquipmentSchema);