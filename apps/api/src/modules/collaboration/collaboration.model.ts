import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnnouncementDocument = Announcement & Document;
export type ResourceMessageDocument = ResourceMessage & Document;

@Schema({ timestamps: true, collection: 'announcements' })
export class Announcement {
  @Prop({ type: Types.ObjectId, ref: 'Resource', required: true })
  resourceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

AnnouncementSchema.index({ resourceId: 1, createdAt: -1 });
AnnouncementSchema.index({ resourceId: 1, pinned: -1, createdAt: -1 });

@Schema({ timestamps: true, collection: 'resourceMessages' })
export class ResourceMessage {
  @Prop({ type: Types.ObjectId, ref: 'Resource', required: true })
  resourceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  // Un seul niveau de réponse : le parent doit être un message racine.
  @Prop({ type: Types.ObjectId, ref: 'ResourceMessage' })
  parentId?: Types.ObjectId;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const ResourceMessageSchema =
  SchemaFactory.createForClass(ResourceMessage);

ResourceMessageSchema.index({ resourceId: 1, createdAt: -1 });
ResourceMessageSchema.index({ parentId: 1 });
