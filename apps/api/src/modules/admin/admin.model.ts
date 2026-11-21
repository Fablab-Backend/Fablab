import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PlatformSettingDocument = HydratedDocument<PlatformSetting>;

/** Paramètre de configuration de la plateforme (clé/valeur). */
@Schema({ timestamps: true, collection: 'platformSettings' })
export class PlatformSetting {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  value: unknown;

  @Prop({ trim: true })
  description?: string;
}

export const PlatformSettingSchema =
  SchemaFactory.createForClass(PlatformSetting);
