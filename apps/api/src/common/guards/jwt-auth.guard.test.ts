import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const USER = {
  _id: { toString: () => 'user-id-1' },
  isActive: true,
  role: UserRole.UTILISATEUR,
};

function makeGuard(opts: {
  isPublic?: boolean;
  token?: string | null;
  payload?: object;
  user?: typeof USER | null;
}) {
  const jwtService = {
    verifyAsync: async () => {
      if (opts.payload === undefined) throw new Error('bad token');
      return opts.payload;
    },
  };
  const usersService = {
    findById: async () => opts.user ?? USER,
  };
  const reflector = {
    getAllAndOverride: () => opts.isPublic,
  } as unknown as Reflector;
  const guard = new JwtAuthGuard(
    jwtService as never,
    usersService as never,
    reflector,
  );

  const request = {
    headers: {
      authorization: opts.token ? `Bearer ${opts.token}` : undefined,
    },
    user: undefined as unknown,
  };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  return { guard, context, request };
}

test('JwtAuthGuard : laisse passer une route publique', async () => {
  const { guard, context } = makeGuard({ isPublic: true });
  assert.equal(await guard.canActivate(context), true);
});

test('JwtAuthGuard : refuse sans header Authorization', async () => {
  const { guard, context } = makeGuard({});
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test('JwtAuthGuard : refuse un token invalide', async () => {
  const { guard, context } = makeGuard({ token: 'bad' });
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test('JwtAuthGuard : authentifie et attache request.user', async () => {
  const { guard, context, request } = makeGuard({
    token: 'good',
    payload: { sub: 'user-id-1', email: 'a@b.c', role: 'Utilisateur' },
  });
  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.user, USER);
});

test('JwtAuthGuard : refuse un compte désactivé', async () => {
  const { guard, context } = makeGuard({
    token: 'good',
    payload: { sub: 'user-id-1' },
    user: { ...USER, isActive: false },
  });
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});
