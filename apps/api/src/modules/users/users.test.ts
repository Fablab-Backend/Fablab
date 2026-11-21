import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

const auditStub = { log: async () => {} };

function makeService(model: Record<string, unknown>) {
  return new UsersService(model as never, auditStub as never);
}

test('create : refuse un e-mail déjà utilisé', async () => {
  const model = {
    findOne: () => ({ lean: async () => ({ _id: 'x' }) }),
  };
  const service = makeService(model);
  await assert.rejects(
    service.create({
      email: 'dup@fablab.local',
      password: 'Password123',
      firstName: 'A',
      lastName: 'B',
    }),
    ConflictException,
  );
});

test('create : hache le mot de passe et applique le rôle par défaut', async () => {
  const created: Record<string, unknown>[] = [];
  const model = {
    findOne: () => ({ lean: async () => null }),
    create: async (doc: Record<string, unknown>) => {
      created.push(doc);
      return { _id: { toString: () => 'new-id' }, ...doc };
    },
  };
  const service = makeService(model);
  const user = await service.create({
    email: 'New@FabLab.local',
    password: 'Password123',
    firstName: 'A',
    lastName: 'B',
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].email, 'new@fablab.local');
  assert.equal(created[0].role, UserRole.UTILISATEUR);
  assert.ok(
    await bcrypt.compare('Password123', created[0].passwordHash as string),
  );
  assert.notEqual(created[0].passwordHash, 'Password123');
  assert.equal(user.role, UserRole.UTILISATEUR);
});

test('findById : 404 sur identifiant invalide ou absent', async () => {
  const model = { findById: async () => null };
  const service = makeService(model);
  await assert.rejects(() => service.findById('pas-un-oid'), NotFoundException);
  await assert.rejects(
    () => service.findById('6b018f4f228e3d5837edab07'),
    NotFoundException,
  );
});

test('validateCredentials : mauvais mot de passe → null', async () => {
  const hash = await bcrypt.hash('BonMotDePasse1', 4);
  const model = {
    findOne: () => ({
      select: () => ({
        exec: async () => ({
          passwordHash: hash,
          isActive: true,
        }),
      }),
    }),
  };
  const service = makeService(model);
  assert.equal(
    await service.validateCredentials('a@b.c', 'mauvais'),
    null,
  );
});

test('validateCredentials : hash absent → null (pas de 500)', async () => {
  // Compte hérité sans passwordHash (ex. créé hors API)
  const model = {
    findOne: () => ({
      select: () => ({
        exec: async () => ({ isActive: true }),
      }),
    }),
  };
  const service = makeService(model);
  assert.equal(await service.validateCredentials('a@b.c', 'peuimporte'), null);
});

test('validateCredentials : compte désactivé → UnauthorizedException', async () => {
  const hash = await bcrypt.hash('BonMotDePasse1', 4);
  const model = {
    findOne: () => ({
      select: () => ({
        exec: async () => ({ passwordHash: hash, isActive: false }),
      }),
    }),
  };
  const service = makeService(model);
  await assert.rejects(
    () => service.validateCredentials('a@b.c', 'BonMotDePasse1'),
    UnauthorizedException,
  );
});

test('toPublic : ne jamais exposer passwordHash', () => {
  const service = makeService({});
  const pub = service.toPublic({
    _id: { toString: () => 'id1' },
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    role: UserRole.UTILISATEUR,
    isActive: true,
    passwordHash: 'SECRET',
  } as never);
  assert.ok(!('passwordHash' in pub));
  assert.equal(pub.id, 'id1');
});
