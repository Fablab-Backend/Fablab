import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './auth.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';

const USER = {
  _id: { toString: () => 'user-id-1' },
  email: 'a@b.c',
  firstName: 'A',
  lastName: 'B',
  role: UserRole.UTILISATEUR,
  isActive: true,
};

function makeService(validateResult: unknown) {
  const auditCalls: { action: string }[] = [];
  const usersService = {
    validateCredentials: async () => validateResult,
    toPublic: (u: typeof USER) => ({ id: 'user-id-1', ...u }),
  };
  const jwtService = { signAsync: async () => 'signed-token' };
  const configService = { get: () => 'secret' };
  const auditService = {
    log: async (entry: { action: string }) => {
      auditCalls.push(entry);
    },
  };
  const service = new AuthService(
    usersService as never,
    jwtService as never,
    configService as never,
    auditService as never,
  );
  return { service, auditCalls };
}

test('login : identifiants invalides → 401 + audit auth.login_failed', async () => {
  const { service, auditCalls } = makeService(null);
  await assert.rejects(
    service.login({ email: 'a@b.c', password: 'x' }),
    UnauthorizedException,
  );
  assert.equal(auditCalls[0]?.action, 'auth.login_failed');
});

test('login : succès → JWT + utilisateur public + audit auth.login', async () => {
  const { service, auditCalls } = makeService(USER);
  const res = await service.login({ email: 'a@b.c', password: 'x' }, '127.0.0.1');
  assert.equal(res.accessToken, 'signed-token');
  assert.equal(res.tokenType, 'Bearer');
  assert.equal(res.user.email, 'a@b.c');
  assert.equal(auditCalls[0]?.action, 'auth.login');
});

test('logout : journalise auth.logout', async () => {
  const { service, auditCalls } = makeService(USER);
  const res = await service.logout('user-id-1');
  assert.equal(res.message.length > 0, true);
  assert.equal(auditCalls[0]?.action, 'auth.logout');
});
