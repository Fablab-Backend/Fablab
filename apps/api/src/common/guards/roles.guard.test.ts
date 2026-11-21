import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

function makeContext(user: { role: UserRole } | undefined, roles?: UserRole[]) {
  const reflector = {
    getAllAndOverride: () => roles,
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
  return { guard, context };
}

test('RolesGuard : autorise si aucune route restreinte', () => {
  const { guard, context } = makeContext(undefined, undefined);
  assert.equal(guard.canActivate(context), true);
});

test('RolesGuard : autorise un rôle requis', () => {
  const { guard, context } = makeContext(
    { role: UserRole.ADMINISTRATEUR },
    [UserRole.ADMINISTRATEUR],
  );
  assert.equal(guard.canActivate(context), true);
});

test('RolesGuard : refuse un rôle non autorisé', () => {
  const { guard, context } = makeContext(
    { role: UserRole.UTILISATEUR },
    [UserRole.ADMINISTRATEUR],
  );
  assert.throws(() => guard.canActivate(context), ForbiddenException);
});

test('RolesGuard : refuse sans utilisateur authentifié', () => {
  const { guard, context } = makeContext(undefined, [UserRole.UTILISATEUR]);
  assert.throws(() => guard.canActivate(context), ForbiddenException);
});
