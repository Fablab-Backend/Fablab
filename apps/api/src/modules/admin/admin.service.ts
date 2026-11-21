import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSetting,
  PlatformSettingDocument,
} from './admin.model';
import { UpdateSettingsDto } from './admin.validation';
import { User, UserDocument } from '../users/users.model';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditLog, AuditLogDocument } from '../audit/audit.model';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(PlatformSetting.name)
    private readonly settingModel: Model<PlatformSettingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly auditService: AuditService,
  ) {}

  /** Statistiques globales de la plateforme ( tableau de bord admin ). */
  async getStats() {
    const [totalUsers, activeUsers, byRole, totalAuditLogs] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ isActive: true }),
        this.userModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
        this.auditLogModel.countDocuments(),
      ]);

    const roles: Record<string, number> = {};
    for (const role of Object.values(UserRole)) roles[role] = 0;
    for (const entry of byRole) roles[entry._id] = entry.count;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: roles,
      },
      auditLogs: { total: totalAuditLogs },
    };
  }

  /** Retourne tous les paramètres de configuration sous forme clé/valeur. */
  async getSettings(): Promise<Record<string, unknown>> {
    const settings = await this.settingModel.find().lean();
    const result: Record<string, unknown> = {};
    for (const s of settings) result[s.key] = s.value;
    return result;
  }

  /** Crée ou met à jour des paramètres de configuration. */
  async updateSettings(
    dto: UpdateSettingsDto,
    actorId?: string,
  ): Promise<Record<string, unknown>> {
    const entries = Object.entries(dto.settings ?? {});
    if (entries.length === 0) {
      throw new NotFoundException('Aucun paramètre fourni');
    }

    for (const [key, value] of entries) {
      await this.settingModel.findOneAndUpdate(
        { key },
        { $set: { key, value } },
        { upsert: true, returnDocument: 'after' },
      );
    }

    await this.auditService.log({
      userId: actorId,
      action: 'settings.updated',
      resourceType: 'settings',
      details: { keys: entries.map(([k]) => k) },
    });

    return this.getSettings();
  }
}
