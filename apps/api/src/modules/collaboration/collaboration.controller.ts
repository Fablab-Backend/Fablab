import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from '../users/users.model';
import { CollaborationService } from './collaboration.service';
import {
  CreateAnnouncementDto,
  CreateMessageDto,
  ListQueryDto,
  UpdateAnnouncementDto,
} from './collaboration.validation';

@Controller('collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  // ---------- Annonces ----------

  @Get('resources/:resourceId/announcements')
  listAnnouncements(@Param('resourceId') resourceId: string) {
    return this.collaborationService.listAnnouncements(resourceId);
  }

  @Post('resources/:resourceId/announcements')
  @Roles(UserRole.RESPONSABLE, UserRole.ADMINISTRATEUR)
  createAnnouncement(
    @CurrentUser() user: UserDocument,
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.collaborationService.createAnnouncement(user, resourceId, dto);
  }

  @Patch('announcements/:id')
  updateAnnouncement(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.collaborationService.updateAnnouncement(user, id, dto);
  }

  @Delete('announcements/:id')
  deleteAnnouncement(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    return this.collaborationService.deleteAnnouncement(user, id);
  }

  // ---------- Messages ----------

  @Get('resources/:resourceId/messages')
  listMessages(
    @Param('resourceId') resourceId: string,
    @Query() query: ListQueryDto,
  ) {
    return this.collaborationService.listMessages(resourceId, query);
  }

  @Post('resources/:resourceId/messages')
  createMessage(
    @CurrentUser() user: UserDocument,
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.collaborationService.createMessage(user, resourceId, dto);
  }

  @Delete('messages/:id')
  deleteMessage(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
  ) {
    return this.collaborationService.deleteMessage(user, id);
  }
}
