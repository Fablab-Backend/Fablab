import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ChatIntent {
  FAQ = 'faq',
  SEARCH_RESOURCE = 'search_resource',
  AVAILABILITY = 'availability',
  UNKNOWN = 'unknown',
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

/** Historique minimal des échanges (supprimé automatiquement après 30 jours). */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'chatMessages',
})
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  reply: string;

  @Prop({ type: String, enum: Object.values(ChatIntent), required: true })
  intent: ChatIntent;

  createdAt?: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });