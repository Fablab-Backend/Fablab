import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from 'eventemitter2';
import {
  EmailStatus,
  Notification,
  NotificationChannel,
  NotificationDocument,
  NotificationType,
} from './notifications.model';
import { MAILER, Mailer } from './notifications.mailer';
import { ListNotificationsQuery } from './notifications.validation';

export const NOTIFICATION_CREATED_EVENT = 'notification.created';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  email?: string;
}

export interface NotificationList {
  items: NotificationDocument[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject(MAILER) private readonly mailer: Mailer,
    // TODO(realtime): provided by EventEmitterModule once the app module wires it.
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async notify(input: NotifyInput): Promise<NotificationDocument> {
    const channels = input.channels ?? ['in_app'];

    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? {},
      channels,
      emailStatus: 'not_requested' as EmailStatus,
    });

    if (channels.includes('email') && input.email) {
      try {
        await this.mailer.send(input.email, input.title, input.message);
        notification.emailStatus = 'sent';
      } catch (error) {
        this.logger.error(
          `Failed to send notification email for notification ${notification.id} to ${input.email}`,
          error instanceof Error ? error.stack : String(error),
        );
        notification.emailStatus = 'failed';
      }
      await notification.save();
    }

    this.eventEmitter?.emit(NOTIFICATION_CREATED_EVENT, notification);
    return notification;
  }

  async listForUser(userId: string, query: ListNotificationsQuery): Promise<NotificationList> {
    const filter: { userId: Types.ObjectId; read?: boolean } = {
      userId: new Types.ObjectId(userId),
    };
    if (query.unreadOnly) {
      filter.read = false;
    }

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      this.notificationModel.countDocuments(filter),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }
}
