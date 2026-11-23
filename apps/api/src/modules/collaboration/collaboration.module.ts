import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Announcement,
  AnnouncementSchema,
  ResourceMessage,
  ResourceMessageSchema,
} from './collaboration.model';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { ResourcesModule } from '../resources/resources.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: ResourceMessage.name, schema: ResourceMessageSchema },
    ]),
    ResourcesModule,
    AuditModule,
  ],
  controllers: [CollaborationController],
  providers: [CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
