import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notifications.model';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MAILER, createMailer } from './notifications.mailer';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: MAILER, useFactory: createMailer },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
