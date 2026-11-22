import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DocumentMetadataDocument = DocumentMetadata & Document;

@Schema({ timestamps: true, collection: 'documents' })
export class DocumentMetadata {
  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true })
  storagePath!: string; // Le chemin vers le fichier dans /uploads

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  // Lien optionnel vers la ressource concernée
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Resource' })
  resourceId?: MongooseSchema.Types.ObjectId;
}

export const DocumentMetadataSchema = SchemaFactory.createForClass(DocumentMetadata);