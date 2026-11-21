import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminService } from './admin.service';
import { NotFoundException } from '@nestjs/common';

function makeService(overrides: Record<string, unknown> = {}) {
  const settingModel = overrides.settingModel ?? {
    findOneAndUpdate: async () => ({}),
    find: () => ({ lean: async () => [] }),
  };
  const userModel = overrides.userModel ?? {
    countDocuments: async () => 0,
    aggregate: async () => [],
  };
  const auditLogModel = { countDocuments: async () => 0 };
  const auditService = { log: async () => {} };
  return new AdminService(
    settingModel as never,
    userModel as never,
    auditLogModel as never,
    auditService as never,
  );
}

test('getStats : agrège les compteurs utilisateurs et audit', async () => {
  const service = makeService({
    userModel: {
      countDocuments: async (filter?: Record<string, unknown>) =>
        filter?.isActive === true ? 4 : 5,
      aggregate: async () => [
        { _id: 'Administrateur', count: 1 },
        { _id: 'Utilisateur', count: 3 },
      ],
    },
  });
  const stats = await service.getStats();
  assert.equal(stats.users.total, 5);
  assert.equal(stats.users.active, 4);
  assert.equal(stats.users.inactive, 1);
  assert.equal(stats.users.byRole.Administrateur, 1);
  assert.equal(stats.users.byRole.Utilisateur, 3);
  assert.equal(stats.users.byRole.Responsable, 0);
});

test('getSettings : retourne un objet clé/valeur', async () => {
  const service = makeService({
    settingModel: {
      find: () => ({
        lean: async () => [
          { key: 'platformName', value: 'FabLab' },
          { key: 'maintenanceMode', value: false },
        ],
      }),
    },
  });
  const settings = await service.getSettings();
  assert.deepEqual(settings, {
    platformName: 'FabLab',
    maintenanceMode: false,
  });
});

test('updateSettings : refuse un payload vide', async () => {
  const service = makeService();
  await assert.rejects(
    () => service.updateSettings({ settings: {} }),
    NotFoundException,
  );
});
