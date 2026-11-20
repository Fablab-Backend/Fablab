import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthenticatedUser, CurrentUser } from './notifications.user';
import { parseListNotificationsQuery } from './notifications.validation';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.notificationsService.listForUser(user.id, parseListNotificationsQuery(query));
  }
}
