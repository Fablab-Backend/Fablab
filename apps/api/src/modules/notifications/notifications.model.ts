import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export enum NotificationType {
  REQUEST_CREATED = 'REQUEST_CREATED',
  REQUEST_VALIDATED = 'REQUEST_VALIDATED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  LOAN_CREATED = 'LOAN_CREATED',
  LOAN_RETURNED = 'LOAN_RETURNED',
  LOAN_REMINDER = 'LOAN_REMINDER',
  LOAN_OVERDUE = 'LOAN_OVERDUE',
  RESERVATION_CONFIRMED = 'RESERVATION_CONFIRMED',
  RESERVATION_CANCELLED = 'RESERVATION_CANCELLED',
}

export type NotificationChannel = 'in_app' | 'email';
export type EmailStatus = 'not_requested' | 'sent' | 'failed';

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  data?: Record<string, unknown>;

  @Prop({ type: [String], enum: ['in_app', 'email'], default: ['in_app'] })
  channels: NotificationChannel[];

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ type: String, enum: ['not_requested', 'sent', 'failed'], default: 'not_requested' })
  emailStatus: EmailStatus;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDocument = Notification;
