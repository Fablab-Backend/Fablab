import 'reflect-metadata';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from '../users/users.model';
import {
  ANNOUNCEMENT_CREATED_EVENT,
  CollaborationService,
  MESSAGE_CREATED_EVENT,
} from './collaboration.service';

const USER_ID = new Types.ObjectId().toHexString();
const OTHER_USER_ID = new Types.ObjectId().toHexString();
const MANAGER_ID = new Types.ObjectId().toHexString();
const RESOURCE_ID = new Types.ObjectId().toHexString();

function makeUser(id: string, role: UserRole): UserDocument {
  return {
    _id: new Types.ObjectId(id),
    id,
    email: `${id}@fablab.local`,
    firstName: 'Test',
    lastName: 'User',
    role,
    isActive: true,
  } as unknown as UserDocument;
}

const USER = makeUser(USER_ID, UserRole.UTILISATEUR);
const OTHER_USER = makeUser(OTHER_USER_ID, UserRole.UTILISATEUR);
const MANAGER = makeUser(MANAGER_ID, UserRole.RESPONSABLE);

const createSaveMock = () => mock.fn<() => Promise<void>>(async () => {});
type SaveMock = ReturnType<typeof createSaveMock>;

function buildAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toHexString(),
    resourceId: new Types.ObjectId(RESOURCE_ID),
    authorId: new Types.ObjectId(USER_ID),
    title: 'Fermeture exceptionnelle',
    content: 'Le FabLab sera fermé lundi.',
    pinned: false,
    isActive: true,
    save: createSaveMock(),
    ...overrides,
  };
}

function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toHexString(),
    resourceId: new Types.ObjectId(RESOURCE_ID),
    authorId: new Types.ObjectId(USER_ID),
    content: 'Bonjour, la perceuse est-elle disponible ?',
    parentId: undefined,
    isDeleted: false,
    save: createSaveMock(),
    ...overrides,
  };
}

function findQuery(items: unknown[]) {
  const lean = mock.fn<() => Promise<unknown[]>>(() => Promise.resolve(items));
  const limit = mock.fn<(n?: number) => { lean: typeof lean }>(() => ({ lean }));
  const skip = mock.fn<(n?: number) => { limit: typeof limit }>(() => ({ limit }));
  const sort = mock.fn<(s?: unknown) => { skip: typeof skip }>(() => ({ skip }));
  return { sort, skip, limit, lean };
}

function findLeanQuery(items: unknown[]) {
  const lean = mock.fn<() => Promise<unknown[]>>(() => Promise.resolve(items));
  const sort = mock.fn<(s?: unknown) => { lean: typeof lean }>(() => ({ lean }));
  return { sort, lean };
}

function makeService() {
  const announcementModel = {
    create: mock.fn<(doc?: unknown) => Promise<unknown>>(),
    find: mock.fn<(filter?: unknown) => unknown>(),
    findById: mock.fn<(id?: unknown) => Promise<unknown>>(),
  };
  const messageModel = {
    create: mock.fn<(doc?: unknown) => Promise<unknown>>(),
    find: mock.fn<(filter?: unknown) => unknown>(),
    findById: mock.fn<(id?: unknown) => Promise<unknown>>(),
    countDocuments: mock.fn<(filter?: unknown) => Promise<number>>(),
  };
  const resourcesService = { findOne: mock.fn<(id?: string) => Promise<unknown>>() };
  const auditService = {
    log: mock.fn<(entry?: Record<string, unknown>) => Promise<void>>(async () => {}),
  };
  const eventEmitter = {
    emit: mock.fn<(event?: string, payload?: unknown) => boolean>(() => true),
  };

  const service = new CollaborationService(
    announcementModel as never,
    messageModel as never,
    resourcesService as never,
    auditService as never,
    eventEmitter as never,
  );
  return {
    service,
    announcementModel,
    messageModel,
    resourcesService,
    auditService,
    eventEmitter,
  };
}

describe('CollaborationService — annonces', () => {
  it('renvoie 404 quand la ressource est introuvable', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => {
      throw new NotFoundException('introuvable');
    });

    await assert.rejects(
      service.listAnnouncements(RESOURCE_ID),
      NotFoundException,
    );
    await assert.rejects(
      service.createMessage(USER, RESOURCE_ID, { content: 'salut' }),
      NotFoundException,
    );
  });

  it('refuse la publication à un utilisateur simple (403)', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));

    await assert.rejects(
      service.createAnnouncement(USER, RESOURCE_ID, {
        title: 'Annonce',
        content: 'Contenu',
      }),
      ForbiddenException,
    );
  });

  it('un responsable publie une annonce, audite et émet announcement.created', async () => {
    const { service, announcementModel, resourcesService, auditService, eventEmitter } =
      makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const announcement = buildAnnouncement({
      authorId: MANAGER._id,
      pinned: true,
    });
    announcementModel.create.mock.mockImplementation(async () => announcement);

    const result = await service.createAnnouncement(MANAGER, RESOURCE_ID, {
      title: 'Maintenance',
      content: 'Maintenance jeudi.',
      pinned: true,
    });

    const created = announcementModel.create.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(created.resourceId, new Types.ObjectId(RESOURCE_ID));
    assert.deepEqual(created.authorId, MANAGER._id);
    assert.equal(created.pinned, true);
    assert.equal(result, announcement);
    assert.equal(auditService.log.mock.callCount(), 1);
    assert.equal(
      (auditService.log.mock.calls[0].arguments[0] as { action: string }).action,
      'announcement.created',
    );
    assert.equal(eventEmitter.emit.mock.callCount(), 1);
    assert.equal(
      eventEmitter.emit.mock.calls[0].arguments[0],
      ANNOUNCEMENT_CREATED_EVENT,
    );
  });

  it('liste les annonces actives, épinglées en premier', async () => {
    const { service, announcementModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const query = findLeanQuery([{ title: 'A' }]);
    announcementModel.find.mock.mockImplementation(() => query);

    await service.listAnnouncements(RESOURCE_ID);

    const filter = announcementModel.find.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.equal(filter.isActive, true);
    const sortArg = query.sort.mock.calls[0].arguments[0] as Record<string, number>;
    assert.deepEqual(sortArg, { pinned: -1, createdAt: -1 });
  });

  it('l’auteur modifie sa propre annonce', async () => {
    const { service, announcementModel } = makeService();
    const announcement = buildAnnouncement({ authorId: USER._id });
    announcementModel.findById.mock.mockImplementation(async () => announcement);

    const result = await service.updateAnnouncement(USER, announcement.id as string, {
      title: 'Nouveau titre',
      pinned: true,
    });

    assert.equal(announcement.title, 'Nouveau titre');
    assert.equal(announcement.pinned, true);
    assert.equal(announcement.save.mock.callCount(), 1);
    assert.equal(result, announcement);
  });

  it('un autre utilisateur ne peut pas modifier l’annonce (403)', async () => {
    const { service, announcementModel } = makeService();
    const announcement = buildAnnouncement({ authorId: USER._id });
    announcementModel.findById.mock.mockImplementation(async () => announcement);

    await assert.rejects(
      service.updateAnnouncement(OTHER_USER, announcement.id as string, {
        title: 'Hack',
      }),
      ForbiddenException,
    );
    assert.equal(announcement.save.mock.callCount(), 0);
  });

  it('un responsable désactive une annonce et audite', async () => {
    const { service, announcementModel, auditService } = makeService();
    const announcement = buildAnnouncement({ authorId: USER._id });
    announcementModel.findById.mock.mockImplementation(async () => announcement);

    await service.deleteAnnouncement(MANAGER, announcement.id as string);

    assert.equal(announcement.isActive, false);
    assert.equal(
      (auditService.log.mock.calls[0].arguments[0] as { action: string }).action,
      'announcement.deleted',
    );
  });
});

describe('CollaborationService — messages', () => {
  it('poste un message et émet message.created', async () => {
    const { service, messageModel, resourcesService, eventEmitter } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const message = buildMessage({ authorId: USER._id });
    messageModel.create.mock.mockImplementation(async () => message);

    const result = await service.createMessage(USER, RESOURCE_ID, {
      content: 'Quelqu’un a testé la fraise ?',
    });

    const created = messageModel.create.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(created.resourceId, new Types.ObjectId(RESOURCE_ID));
    assert.deepEqual(created.authorId, USER._id);
    assert.equal(result, message);
    assert.equal(
      eventEmitter.emit.mock.calls[0].arguments[0],
      MESSAGE_CREATED_EVENT,
    );
  });

  it('accepte une réponse à un message racine de la même ressource', async () => {
    const { service, messageModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const parent = buildMessage();
    const reply = buildMessage({ parentId: parent._id });
    messageModel.findById.mock.mockImplementation(async () => parent);
    messageModel.create.mock.mockImplementation(async () => reply);

    await service.createMessage(OTHER_USER, RESOURCE_ID, {
      content: 'Oui, elle marche très bien.',
      parentId: parent.id as string,
    });

    const created = messageModel.create.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(created.parentId, parent._id);
  });

  it('refuse une réponse à une réponse (un seul niveau)', async () => {
    const { service, messageModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const nested = buildMessage({
      parentId: new Types.ObjectId(),
    });
    messageModel.findById.mock.mockImplementation(async () => nested);

    await assert.rejects(
      service.createMessage(USER, RESOURCE_ID, {
        content: 'Encore une réponse',
        parentId: nested.id as string,
      }),
      BadRequestException,
    );
  });

  it('refuse un parentId pointant vers une autre ressource', async () => {
    const { service, messageModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    const parent = buildMessage({
      resourceId: new Types.ObjectId(),
    });
    messageModel.findById.mock.mockImplementation(async () => parent);

    await assert.rejects(
      service.createMessage(USER, RESOURCE_ID, {
        content: 'Réponse',
        parentId: parent.id as string,
      }),
      BadRequestException,
    );
  });

  it('liste les messages paginés sans les supprimés', async () => {
    const { service, messageModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => ({ isActive: true }));
    messageModel.find.mock.mockImplementation(() => findQuery([{ content: 'A' }]));
    messageModel.countDocuments.mock.mockImplementation(async () => 1);

    const result = await service.listMessages(RESOURCE_ID, { page: 2, limit: 10 });

    const filter = messageModel.find.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.equal(filter.isDeleted, false);
    assert.equal(result.page, 2);
    assert.equal(result.total, 1);
  });

  it('l’auteur supprime son propre message', async () => {
    const { service, messageModel, auditService } = makeService();
    const message = buildMessage({ authorId: USER._id });
    messageModel.findById.mock.mockImplementation(async () => message);

    await service.deleteMessage(USER, message.id as string);

    assert.equal(message.isDeleted, true);
    assert.equal(message.save.mock.callCount(), 1);
    assert.equal(auditService.log.mock.callCount(), 0);
  });

  it('un autre utilisateur ne peut pas supprimer le message (403)', async () => {
    const { service, messageModel } = makeService();
    const message = buildMessage({ authorId: USER._id });
    messageModel.findById.mock.mockImplementation(async () => message);

    await assert.rejects(
      service.deleteMessage(OTHER_USER, message.id as string),
      ForbiddenException,
    );
    assert.equal(message.save.mock.callCount(), 0);
  });

  it('un responsable supprime le message d’un autre et audite', async () => {
    const { service, messageModel, auditService } = makeService();
    const message = buildMessage({ authorId: USER._id });
    messageModel.findById.mock.mockImplementation(async () => message);

    await service.deleteMessage(MANAGER, message.id as string);

    assert.equal(message.isDeleted, true);
    assert.equal(auditService.log.mock.callCount(), 1);
    assert.equal(
      (auditService.log.mock.calls[0].arguments[0] as { action: string }).action,
      'message.deleted',
    );
  });
});
