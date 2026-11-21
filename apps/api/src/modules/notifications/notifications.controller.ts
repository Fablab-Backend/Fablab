import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../../modules/users/users.model';
import { NotificationsService } from './notifications.service';
import { parseListNotificationsQuery } from './notifications.validation';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: UserDocument, @Query() query: Record<string, unknown>) {
    return this.notificationsService.listForUser(user.id, parseListNotificationsQuery(query));
  }
}
