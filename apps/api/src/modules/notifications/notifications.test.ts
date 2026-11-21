import 'reflect-metadata';
import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserDocument } from '../users/users.model';
import { NotificationType } from './notifications.model';
import { NotificationsController } from './notifications.controller';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationsService,
} from './notifications.service';

const USER_ID = new Types.ObjectId().toHexString();
const OTHER_USER_ID = new Types.ObjectId().toHexString();

function buildNotificationDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toHexString(),
    userId: new Types.ObjectId(USER_ID),
    type: NotificationType.LOAN_CREATED,
    title: 'Prêt créé',
    message: 'Votre prêt a été créé',
    data: {},
    channels: ['in_app'],
    read: false,
    readAt: undefined,
    emailStatus: 'not_requested',
    save: mock.fn<() => Promise<void>>(async () => {}),
    ...overrides,
  };
}

function findQuery(items: unknown[]) {
  const limit = mock.fn<(n?: number) => Promise<unknown[]>>(() =>
    Promise.resolve(items),
  );
  const skip = mock.fn<(n?: number) => { limit: typeof limit }>(() => ({ limit }));
  const sort = mock.fn<(s?: unknown) => { skip: typeof skip }>(() => ({ skip }));
  return { sort, skip, limit };
}

function makeService() {
  const notificationModel = {
    create: mock.fn<(doc?: unknown) => Promise<unknown>>(),
    find: mock.fn<(filter?: unknown) => unknown>(),
    countDocuments: mock.fn<(filter?: unknown) => Promise<number>>(),
  };
  const mailer = {
    send: mock.fn<(to: string, subject: string, body: string) => Promise<void>>(
      async () => {},
    ),
  };
  const eventEmitter = {
    emit: mock.fn<(event: string, payload?: unknown) => boolean>(() => true),
  };
  const service = new NotificationsService(
    notificationModel as never,
    mailer as never,
    eventEmitter as never,
  );
  return { service, notificationModel, mailer, eventEmitter };
}

describe('NotificationsService.notify', () => {
  it('crée une notification avec le canal in_app par défaut et emailStatus not_requested', async () => {
    const { service, notificationModel, mailer, eventEmitter } = makeService();
    const doc = buildNotificationDoc();
    notificationModel.create.mock.mockImplementation(async () => doc);

    const result = await service.notify({
      userId: USER_ID,
      type: NotificationType.LOAN_CREATED,
      title: 'Prêt créé',
      message: 'Votre prêt a été créé',
    });

    assert.deepEqual(notificationModel.create.mock.calls[0].arguments[0], {
      userId: new Types.ObjectId(USER_ID),
      type: NotificationType.LOAN_CREATED,
      title: 'Prêt créé',
      message: 'Votre prêt a été créé',
      data: {},
      channels: ['in_app'],
      emailStatus: 'not_requested',
    });
    assert.equal(mailer.send.mock.callCount(), 0);
    assert.equal(result, doc);
    assert.equal(eventEmitter.emit.mock.calls[0].arguments[0], NOTIFICATION_CREATED_EVENT);
    assert.equal(eventEmitter.emit.mock.calls[0].arguments[1], doc);
  });

  it('envoie le courriel et passe emailStatus à sent quand le canal email est demandé', async () => {
    const { service, notificationModel, mailer } = makeService();
    const doc = buildNotificationDoc();
    notificationModel.create.mock.mockImplementation(async () => doc);

    await service.notify({
      userId: USER_ID,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Réservation confirmée',
      message: 'Votre réservation est confirmée',
      channels: ['in_app', 'email'],
      email: 'user@example.com',
    });

    assert.deepEqual(mailer.send.mock.calls[0].arguments, [
      'user@example.com',
      'Réservation confirmée',
      'Votre réservation est confirmée',
    ]);
    assert.equal(doc.emailStatus, 'sent');
    assert.equal(doc.save.mock.callCount(), 1);
  });

  it("ne lève pas d'erreur quand le Mailer échoue et passe emailStatus à failed", async () => {
    const { service, notificationModel, mailer } = makeService();
    const doc = buildNotificationDoc();
    notificationModel.create.mock.mockImplementation(async () => doc);
    mailer.send.mock.mockImplementation(async () => {
      throw new Error('SMTP down');
    });

    const result = await service.notify({
      userId: USER_ID,
      type: NotificationType.LOAN_REMINDER,
      title: 'Rappel',
      message: 'Pensez à rendre votre matériel',
      channels: ['email'],
      email: 'user@example.com',
    });

    assert.equal(result, doc);
    assert.equal(doc.emailStatus, 'failed');
    assert.equal(doc.save.mock.callCount(), 1);
  });

  it('propage les erreurs de création en base', async () => {
    const { service, notificationModel } = makeService();
    notificationModel.create.mock.mockImplementation(async () => {
      throw new Error('Mongo down');
    });

    await assert.rejects(
      service.notify({
        userId: USER_ID,
        type: NotificationType.LOAN_CREATED,
        title: 'Prêt créé',
        message: 'Votre prêt a été créé',
      }),
      /Mongo down/,
    );
  });
});

describe('NotificationsService.listForUser', () => {
  it('renvoie les notifications triées de la plus récente à la plus ancienne avec pagination', async () => {
    const { service, notificationModel } = makeService();
    const items = [buildNotificationDoc(), buildNotificationDoc()];
    const query = findQuery(items);
    notificationModel.find.mock.mockImplementation(() => query);
    notificationModel.countDocuments.mock.mockImplementation(async () => 5);

    const result = await service.listForUser(USER_ID, {
      page: 2,
      limit: 2,
      unreadOnly: false,
    });

    assert.deepEqual(notificationModel.find.mock.calls[0].arguments[0], {
      userId: new Types.ObjectId(USER_ID),
    });
    assert.deepEqual(query.sort.mock.calls[0].arguments[0], { createdAt: -1 });
    assert.deepEqual(query.skip.mock.calls[0].arguments[0], 2);
    assert.deepEqual(query.limit.mock.calls[0].arguments[0], 2);
    assert.deepEqual(result, { items, total: 5, page: 2, limit: 2 });
  });

  it("filtre les notifications non lues quand unreadOnly est vrai", async () => {
    const { service, notificationModel } = makeService();
    const query = findQuery([]);
    notificationModel.find.mock.mockImplementation(() => query);
    notificationModel.countDocuments.mock.mockImplementation(async () => 0);

    await service.listForUser(USER_ID, { page: 1, limit: 20, unreadOnly: true });

    assert.deepEqual(notificationModel.find.mock.calls[0].arguments[0], {
      userId: new Types.ObjectId(USER_ID),
      read: false,
    });
    assert.deepEqual(notificationModel.countDocuments.mock.calls[0].arguments[0], {
      userId: new Types.ObjectId(USER_ID),
      read: false,
    });
  });

  it("n'expose jamais les notifications d'un autre utilisateur", async () => {
    const { service, notificationModel } = makeService();
    notificationModel.find.mock.mockImplementation(() => findQuery([]));
    notificationModel.countDocuments.mock.mockImplementation(async () => 0);

    await service.listForUser(USER_ID, { page: 1, limit: 20, unreadOnly: false });

    const filter = notificationModel.find.mock.calls[0].arguments[0] as {
      userId: Types.ObjectId;
    };
    assert.equal(filter.userId.toHexString(), USER_ID);
    assert.notEqual(filter.userId.toHexString(), OTHER_USER_ID);
  });
});

describe('GET /api/notifications', () => {
  const userDocument = {
    _id: new Types.ObjectId(USER_ID),
    id: USER_ID,
    email: 'user@fablab.local',
    role: UserRole.UTILISATEUR,
    isActive: true,
  } as unknown as UserDocument;

  let app: INestApplication;
  let notificationModel: ReturnType<typeof makeService>['notificationModel'];

  before(async () => {
    const { service, notificationModel: model } = makeService();
    notificationModel = model;

    // Vrai guard JWT : JwtService et UsersService sont simulés, le guard lui-même est réel.
    const jwtAuthGuard = new JwtAuthGuard(
      { verifyAsync: async () => ({ sub: USER_ID }) } as never,
      { findById: async () => userDocument } as never,
      new Reflector(),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(jwtAuthGuard);
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('renvoie une liste paginée pour l’utilisateur authentifié', async () => {
    const items = [buildNotificationDoc()];
    notificationModel.find.mock.mockImplementation(() => findQuery(items));
    notificationModel.countDocuments.mock.mockImplementation(async () => 1);

    const response = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer fake-token')
      .query({ page: 1, limit: 10 })
      .expect(200);

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.items));
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.limit, 10);
    assert.deepEqual(
      notificationModel.find.mock.calls.at(-1)?.arguments[0],
      { userId: new Types.ObjectId(USER_ID) },
    );
  });

  it('transmet unreadOnly au service', async () => {
    notificationModel.find.mock.mockImplementation(() => findQuery([]));
    notificationModel.countDocuments.mock.mockImplementation(async () => 0);

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer fake-token')
      .query({ unreadOnly: 'true' })
      .expect(200);

    assert.deepEqual(
      notificationModel.find.mock.calls.at(-1)?.arguments[0],
      { userId: new Types.ObjectId(USER_ID), read: false },
    );
  });

  it('rejette les paramètres de pagination invalides avec 400', async () => {
    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer fake-token')
      .query({ limit: 500 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', 'Bearer fake-token')
      .query({ page: 'abc' })
      .expect(400);
  });

  it('renvoie 401 sans token', async () => {
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
  });
});
