import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from 'eventemitter2';
import { Types } from 'mongoose';
import request from 'supertest';
import { Notification, NotificationType } from './notifications.model';
import { NotificationsController } from './notifications.controller';
import { NotificationsService, NOTIFICATION_CREATED_EVENT } from './notifications.service';
import { MAILER, Mailer } from './notifications.mailer';
import { AuthenticatedUser } from './notifications.user';

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
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockFindQuery(items: unknown[]) {
  const limit = jest.fn().mockResolvedValue(items);
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  return { sort, skip, limit };
}

async function createServiceMocks() {
  const notificationModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };
  const mailer: jest.Mocked<Mailer> = { send: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: getModelToken(Notification.name), useValue: notificationModel },
      { provide: MAILER, useValue: mailer },
      { provide: EventEmitter2, useValue: eventEmitter },
    ],
  }).compile();

  const service = moduleRef.get(NotificationsService);
  return { service, notificationModel, mailer, eventEmitter };
}

describe('NotificationsService.notify', () => {
  it('creates a notification with default in_app channel and not_requested email status', async () => {
    const { service, notificationModel, mailer, eventEmitter } = await createServiceMocks();
    const doc = buildNotificationDoc();
    notificationModel.create.mockResolvedValue(doc);

    const result = await service.notify({
      userId: USER_ID,
      type: NotificationType.LOAN_CREATED,
      title: 'Prêt créé',
      message: 'Votre prêt a été créé',
    });

    expect(notificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: new Types.ObjectId(USER_ID),
        type: NotificationType.LOAN_CREATED,
        channels: ['in_app'],
        emailStatus: 'not_requested',
      }),
    );
    expect(mailer.send).not.toHaveBeenCalled();
    expect(result).toBe(doc);
    expect(eventEmitter.emit).toHaveBeenCalledWith(NOTIFICATION_CREATED_EVENT, doc);
  });

  it('sends an email and marks emailStatus as sent when the email channel is requested', async () => {
    const { service, notificationModel, mailer } = await createServiceMocks();
    const doc = buildNotificationDoc();
    notificationModel.create.mockResolvedValue(doc);

    await service.notify({
      userId: USER_ID,
      type: NotificationType.RESERVATION_CONFIRMED,
      title: 'Réservation confirmée',
      message: 'Votre réservation est confirmée',
      channels: ['in_app', 'email'],
      email: 'user@example.com',
    });

    expect(mailer.send).toHaveBeenCalledWith(
      'user@example.com',
      'Réservation confirmée',
      'Votre réservation est confirmée',
    );
    expect(doc.emailStatus).toBe('sent');
    expect(doc.save).toHaveBeenCalled();
  });

  it('does not throw when the mailer fails and marks emailStatus as failed', async () => {
    const { service, notificationModel, mailer } = await createServiceMocks();
    const doc = buildNotificationDoc();
    notificationModel.create.mockResolvedValue(doc);
    mailer.send.mockRejectedValue(new Error('SMTP down'));

    const result = await service.notify({
      userId: USER_ID,
      type: NotificationType.LOAN_REMINDER,
      title: 'Rappel',
      message: 'Pensez à rendre votre matériel',
      channels: ['email'],
      email: 'user@example.com',
    });

    expect(result).toBe(doc);
    expect(doc.emailStatus).toBe('failed');
    expect(doc.save).toHaveBeenCalled();
  });

  it('propagates database creation errors', async () => {
    const { service, notificationModel } = await createServiceMocks();
    notificationModel.create.mockRejectedValue(new Error('Mongo down'));

    await expect(
      service.notify({
        userId: USER_ID,
        type: NotificationType.LOAN_CREATED,
        title: 'Prêt créé',
        message: 'Votre prêt a été créé',
      }),
    ).rejects.toThrow('Mongo down');
  });
});

describe('NotificationsService.listForUser', () => {
  it('returns notifications sorted by newest first with pagination metadata', async () => {
    const { service, notificationModel } = await createServiceMocks();
    const items = [buildNotificationDoc(), buildNotificationDoc()];
    const query = mockFindQuery(items);
    notificationModel.find.mockReturnValue(query);
    notificationModel.countDocuments.mockResolvedValue(5);

    const result = await service.listForUser(USER_ID, { page: 2, limit: 2, unreadOnly: false });

    expect(notificationModel.find).toHaveBeenCalledWith({ userId: new Types.ObjectId(USER_ID) });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(2);
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(notificationModel.countDocuments).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
    });
    expect(result).toEqual({ items, total: 5, page: 2, limit: 2 });
  });

  it('filters unread notifications only', async () => {
    const { service, notificationModel } = await createServiceMocks();
    const query = mockFindQuery([]);
    notificationModel.find.mockReturnValue(query);
    notificationModel.countDocuments.mockResolvedValue(0);

    await service.listForUser(USER_ID, { page: 1, limit: 20, unreadOnly: true });

    expect(notificationModel.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
      read: false,
    });
  });

  it('never returns notifications belonging to another user', async () => {
    const { service, notificationModel } = await createServiceMocks();
    notificationModel.find.mockReturnValue(mockFindQuery([]));
    notificationModel.countDocuments.mockResolvedValue(0);

    await service.listForUser(USER_ID, { page: 1, limit: 20, unreadOnly: false });

    const filter = notificationModel.find.mock.calls[0][0] as { userId: Types.ObjectId };
    expect(filter.userId.toHexString()).toBe(USER_ID);
    expect(filter.userId.toHexString()).not.toBe(OTHER_USER_ID);
  });
});

describe('GET /api/notifications', () => {
  const currentUser: AuthenticatedUser = { id: USER_ID, role: 'user' };
  let app: INestApplication;
  let notificationModel: {
    create: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };
  let service: NotificationsService;

  beforeAll(async () => {
    const mocks = await createServiceMocks();
    service = mocks.service;
    notificationModel = mocks.notificationModel;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = currentUser;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a paginated list for the authenticated user', async () => {
    const items = [buildNotificationDoc()];
    notificationModel.find.mockReturnValue(mockFindQuery(items));
    notificationModel.countDocuments.mockResolvedValue(1);

    const response = await request(app.getHttpServer())
      .get('/api/notifications')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toEqual({ items: expect.any(Array), total: 1, page: 1, limit: 10 });
    expect(notificationModel.find).toHaveBeenCalledWith({ userId: new Types.ObjectId(USER_ID) });
  });

  it('passes unreadOnly through to the service layer', async () => {
    notificationModel.find.mockReturnValue(mockFindQuery([]));
    notificationModel.countDocuments.mockResolvedValue(0);

    await request(app.getHttpServer())
      .get('/api/notifications')
      .query({ unreadOnly: 'true' })
      .expect(200);

    expect(notificationModel.find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(USER_ID),
      read: false,
    });
  });

  it('rejects invalid pagination parameters with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/notifications')
      .query({ limit: 500 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/notifications')
      .query({ page: 'abc' })
      .expect(400);
  });
});
