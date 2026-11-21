import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSetting, PlatformSettingSchema } from './admin.model';
import { User, UserSchema } from '../users/users.model';
import { AuditLog, AuditLogSchema } from '../audit/audit.model';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
      { name: User.name, schema: UserSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
