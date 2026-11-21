import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditService } from './audit.service';

function makeService() {
  const created: Record<string, unknown>[] = [];
  const model = {
    create: async (doc: Record<string, unknown>) => {
      created.push(doc);
      return doc;
    },
  };
  return { service: new AuditService(model as never), created };
}

test('log : enregistre l\'entrée dans auditLogs', async () => {
  const { service, created } = makeService();
  await service.log({
    userId: '6b018f4f228e3d5837edab07',
    action: 'auth.login',
    resourceType: 'auth',
    resourceId: '6b018f4f228e3d5837edab07',
    ip: '127.0.0.1',
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].action, 'auth.login');
  assert.equal(created[0].resourceType, 'auth');
  assert.ok(created[0].userId); // converti en ObjectId
});

test('log : ne bloque pas en cas d\'erreur base', async () => {
  const model = {
    create: async () => {
      throw new Error('db down');
    },
  };
  const service = new AuditService(model as never);
  await service.log({ action: 'x', resourceType: 'y' }); // ne doit pas throw
});

test('findAll : pagine et filtre par action', async () => {
  const filters: Record<string, unknown>[] = [];
  const model = {
    find: (filter: Record<string, unknown>) => {
      filters.push(filter);
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({ lean: async () => [{ action: 'auth.login' }] }),
          }),
        }),
      };
    },
    countDocuments: async () => 1,
  };
  const service = new AuditService(model as never);
  const res = await service.findAll({ action: 'auth.login', page: 2, limit: 10 });
  assert.equal(res.total, 1);
  assert.equal(res.page, 2);
  assert.equal((filters[0] as { action: string }).action, 'auth.login');
});
