import 'reflect-metadata';
import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserDocument } from '../users/users.model';
import { EquipmentCondition, LoanStatus } from './loans.model';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

const USER_ID = new Types.ObjectId().toHexString();
const MANAGER_ID = new Types.ObjectId().toHexString();
const EQUIPMENT_ID = new Types.ObjectId().toHexString();
const OTHER_USER_ID = new Types.ObjectId().toHexString();

const DAY_MS = 24 * 60 * 60 * 1000;

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
const MANAGER = makeUser(MANAGER_ID, UserRole.RESPONSABLE);

function futureDueAt(days = 7): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function buildEquipment(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(EQUIPMENT_ID),
    id: EQUIPMENT_ID,
    type: 'Equipment',
    name: 'Perceuse visseuse',
    state: 'available',
    isActive: true,
    ...overrides,
  };
}

const createSaveMock = () => mock.fn<() => Promise<void>>(async () => {});
type SaveMock = ReturnType<typeof createSaveMock>;

interface MockLoan {
  _id: Types.ObjectId;
  id: string;
  equipmentId: Types.ObjectId;
  borrowerId: Types.ObjectId;
  status: LoanStatus;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt?: Date;
  conditionAtLoan: EquipmentCondition;
  conditionAtReturn?: EquipmentCondition;
  handledBy?: Types.ObjectId;
  save: SaveMock;
}

function buildLoan(overrides: Partial<MockLoan> = {}): MockLoan {
  return {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toHexString(),
    equipmentId: new Types.ObjectId(EQUIPMENT_ID),
    borrowerId: new Types.ObjectId(USER_ID),
    status: LoanStatus.ACTIVE,
    borrowedAt: new Date(),
    dueAt: new Date(Date.now() + 7 * DAY_MS),
    conditionAtLoan: EquipmentCondition.GOOD,
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

function makeService() {
  const loanModel = {
    create: mock.fn<(doc?: unknown) => Promise<unknown>>(),
    find: mock.fn<(filter?: unknown) => unknown>(),
    findById: mock.fn<(id?: unknown) => Promise<unknown>>(),
    countDocuments: mock.fn<(filter?: unknown) => Promise<number>>(),
  };
  const resourcesService = { findOne: mock.fn<(id?: string) => Promise<unknown>>() };
  const notificationsService = {
    notify: mock.fn<(input?: Record<string, unknown>) => Promise<unknown>>(
      async () => ({}),
    ),
  };
  const usersService = {
    findAll: mock.fn<() => Promise<{ items: { id: string }[] }>>(async () => ({
      items: [],
    })),
  };
  const auditService = {
    log: mock.fn<(entry?: Record<string, unknown>) => Promise<void>>(async () => {}),
  };

  const service = new LoansService(
    loanModel as never,
    resourcesService as never,
    notificationsService as never,
    usersService as never,
    auditService as never,
  );
  return { service, loanModel, resourcesService, notificationsService, usersService, auditService };
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    equipmentId: EQUIPMENT_ID,
    dueAt: futureDueAt(),
    conditionAtLoan: EquipmentCondition.GOOD,
    ...overrides,
  };
}

describe('LoansService.create', () => {
  it('crée un prêt pour l’utilisateur connecté et notifie', async () => {
    const { service, loanModel, resourcesService, notificationsService, auditService } =
      makeService();
    const equipment = buildEquipment();
    const loan = buildLoan();
    resourcesService.findOne.mock.mockImplementation(async () => equipment);
    loanModel.create.mock.mockImplementation(async () => loan);

    const result = await service.create(USER, validCreateBody());

    const created = loanModel.create.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(created.equipmentId, new Types.ObjectId(EQUIPMENT_ID));
    assert.deepEqual(created.borrowerId, USER._id);
    assert.equal(created.status, LoanStatus.ACTIVE);
    assert.equal(created.conditionAtLoan, EquipmentCondition.GOOD);
    assert.equal(result, loan);
    assert.equal(notificationsService.notify.mock.callCount(), 1);
    assert.equal(
      (notificationsService.notify.mock.calls[0].arguments[0] as { type: string }).type,
      'LOAN_CREATED',
    );
    assert.equal(auditService.log.mock.callCount(), 1);
    assert.equal(
      (auditService.log.mock.calls[0].arguments[0] as { action: string }).action,
      'loan.created',
    );
  });

  it('traduit une erreur de doublon Mongo 11000 en 409', async () => {
    const { service, loanModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());
    loanModel.create.mock.mockImplementation(async () => {
      throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    });

    await assert.rejects(service.create(USER, validCreateBody()), ConflictException);
  });

  it('refuse un dueAt dans le passé', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());

    await assert.rejects(
      service.create(
        USER,
        validCreateBody({ dueAt: new Date(Date.now() - DAY_MS).toISOString() }),
      ),
      BadRequestException,
    );
  });

  it('refuse un dueAt au-delà de LOAN_MAX_DAYS (défaut 14)', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());

    await assert.rejects(
      service.create(USER, validCreateBody({ dueAt: futureDueAt(30) })),
      BadRequestException,
    );
  });

  it('propage 404 quand la ressource est introuvable', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => {
      throw new NotFoundException('introuvable');
    });

    await assert.rejects(service.create(USER, validCreateBody()), NotFoundException);
  });

  const unusableEquipmentCases: [string, Record<string, unknown>][] = [
    ['un équipement cassé', { state: 'broken' }],
    ['un équipement en maintenance', { state: 'maintenance' }],
    ['un équipement désactivé', { isActive: false }],
    ['une salle', { type: 'Room' }],
  ];
  for (const [label, overrides] of unusableEquipmentCases) {
    it(`refuse ${label} avec 400`, async () => {
      const { service, resourcesService } = makeService();
      resourcesService.findOne.mock.mockImplementation(async () =>
        buildEquipment(overrides),
      );

      await assert.rejects(
        service.create(USER, validCreateBody()),
        BadRequestException,
      );
    });
  }

  it('refuse borrowerId à un utilisateur simple', async () => {
    const { service, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());

    await assert.rejects(
      service.create(USER, validCreateBody({ borrowerId: OTHER_USER_ID })),
      ForbiddenException,
    );
  });

  it('autorise borrowerId à un responsable', async () => {
    const { service, loanModel, resourcesService } = makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());
    loanModel.create.mock.mockImplementation(async () => buildLoan());

    await service.create(
      MANAGER,
      validCreateBody({ borrowerId: OTHER_USER_ID }),
    );

    const created = loanModel.create.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(created.borrowerId, new Types.ObjectId(OTHER_USER_ID));
  });

  it('ne casse pas la création quand la notification échoue', async () => {
    const { service, loanModel, resourcesService, notificationsService } =
      makeService();
    resourcesService.findOne.mock.mockImplementation(async () => buildEquipment());
    loanModel.create.mock.mockImplementation(async () => buildLoan());
    notificationsService.notify.mock.mockImplementation(async () => {
      throw new Error('notifications down');
    });

    const result = await service.create(USER, validCreateBody());
    assert.ok(result);
  });
});

describe('LoansService.returnLoan', () => {
  it('enregistre le retour et notifie l’emprunteur', async () => {
    const { service, loanModel, notificationsService, auditService, usersService } =
      makeService();
    const loan = buildLoan();
    loanModel.findById.mock.mockImplementation(async () => loan);

    const result = await service.returnLoan(MANAGER, loan.id as string, {
      conditionAtReturn: EquipmentCondition.GOOD,
    });

    assert.equal(loan.status, LoanStatus.RETURNED);
    assert.ok(loan.returnedAt);
    assert.ok(loan.returnedAt instanceof Date);
    assert.equal(loan.conditionAtReturn, EquipmentCondition.GOOD);
    assert.deepEqual(loan.handledBy, MANAGER._id);
    assert.equal(loan.save.mock.callCount(), 1);
    assert.equal(result, loan);
    assert.equal(
      (auditService.log.mock.calls[0].arguments[0] as { action: string }).action,
      'loan.returned',
    );
    const notifyTypes = notificationsService.notify.mock.calls.map(
      (c) => (c.arguments[0] as { type: string }).type,
    );
    assert.deepEqual(notifyTypes, ['LOAN_RETURNED']);
    assert.equal(usersService.findAll.mock.callCount(), 0);
  });

  it('renvoie 409 sur un prêt déjà retourné', async () => {
    const { service, loanModel } = makeService();
    loanModel.findById.mock.mockImplementation(async () =>
      buildLoan({ status: LoanStatus.RETURNED }),
    );

    await assert.rejects(
      service.returnLoan(MANAGER, 'loan-id', {
        conditionAtReturn: EquipmentCondition.GOOD,
      }),
      ConflictException,
    );
  });

  it('renvoie 404 sur un prêt inconnu', async () => {
    const { service, loanModel } = makeService();
    loanModel.findById.mock.mockImplementation(async () => null);

    await assert.rejects(
      service.returnLoan(MANAGER, 'inconnu', {
        conditionAtReturn: EquipmentCondition.GOOD,
      }),
      NotFoundException,
    );
  });

  it('interdit le retour à un utilisateur, y compris l’emprunteur lui-même', async () => {
    const { service, loanModel } = makeService();
    const loan = buildLoan({ borrowerId: new Types.ObjectId(USER_ID) });
    loanModel.findById.mock.mockImplementation(async () => loan);

    await assert.rejects(
      service.returnLoan(USER, loan.id as string, {
        conditionAtReturn: EquipmentCondition.GOOD,
      }),
      ForbiddenException,
    );
    assert.equal(loan.save.mock.callCount(), 0);
  });

  it('notifie les responsables quand le matériel est retourné endommagé', async () => {
    const { service, loanModel, notificationsService, usersService } = makeService();
    const loan = buildLoan();
    loanModel.findById.mock.mockImplementation(async () => loan);
    let findAllCalls = 0;
    usersService.findAll.mock.mockImplementation(async () => {
      findAllCalls += 1;
      return findAllCalls === 1 ? { items: [{ id: MANAGER_ID }] } : { items: [] };
    });

    await service.returnLoan(MANAGER, loan.id as string, {
      conditionAtReturn: EquipmentCondition.DAMAGED,
    });

    assert.ok(usersService.findAll.mock.callCount() >= 1);
    const managerNotify = notificationsService.notify.mock.calls.filter(
      (c) =>
        (c.arguments[0] as { userId: string }).userId === MANAGER_ID &&
        (c.arguments[0] as { title: string }).title ===
          'Retour de matériel à vérifier',
    );
    assert.equal(managerNotify.length, 1);
  });
});

describe('LoansService.findAll', () => {
  it('restreint un utilisateur à ses propres prêts', async () => {
    const { service, loanModel } = makeService();
    loanModel.find.mock.mockImplementation(() => findQuery([]));
    loanModel.countDocuments.mock.mockImplementation(async () => 0);

    await service.findAll(USER, {});

    const filter = loanModel.find.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(filter.borrowerId, USER._id);
  });

  it('laisse un responsable voir tous les prêts', async () => {
    const { service, loanModel } = makeService();
    loanModel.find.mock.mockImplementation(() => findQuery([]));
    loanModel.countDocuments.mock.mockImplementation(async () => 0);

    await service.findAll(MANAGER, {});

    const filter = loanModel.find.mock.calls[0].arguments[0] as Record<
      string,
      unknown
    >;
    assert.equal(filter.borrowerId, undefined);
  });

  it('expose le statut effectif OVERDUE à la lecture', async () => {
    const { service, loanModel } = makeService();
    const items = [
      { status: LoanStatus.ACTIVE, dueAt: new Date(Date.now() - DAY_MS) },
      { status: LoanStatus.ACTIVE, dueAt: new Date(Date.now() + DAY_MS) },
      { status: LoanStatus.RETURNED, dueAt: new Date(Date.now() - DAY_MS) },
    ];
    loanModel.find.mock.mockImplementation(() => findQuery(items));
    loanModel.countDocuments.mock.mockImplementation(async () => 3);

    const result = await service.findAll(MANAGER, {});

    assert.deepEqual(
      result.items.map((i) => i.status),
      [LoanStatus.OVERDUE, LoanStatus.ACTIVE, LoanStatus.RETURNED],
    );
  });

  it('filtre par statut effectif OVERDUE et par équipement', async () => {
    const { service, loanModel } = makeService();
    loanModel.find.mock.mockImplementation(() => findQuery([]));
    loanModel.countDocuments.mock.mockImplementation(async () => 0);

    await service.findAll(MANAGER, {
      status: LoanStatus.OVERDUE,
      equipmentId: EQUIPMENT_ID,
    });

    const filter = loanModel.find.mock.calls[0].arguments[0] as {
      $or?: unknown[];
      equipmentId?: Types.ObjectId;
    };
    assert.ok(Array.isArray(filter.$or));
    assert.deepEqual(filter.equipmentId, new Types.ObjectId(EQUIPMENT_ID));
  });
});

describe('/api/loans', () => {
  const usersByToken: Record<string, UserDocument> = {
    'user-token': USER,
    'manager-token': MANAGER,
  };

  let app: INestApplication;
  let mocks: ReturnType<typeof makeService>;

  before(async () => {
    mocks = makeService();

    const jwtAuthGuard = new JwtAuthGuard(
      {
        verifyAsync: async (token: string) => {
          if (!usersByToken[token]) throw new Error('bad token');
          return { sub: usersByToken[token]._id.toString() };
        },
      } as never,
      {
        findById: async (id: string) => {
          const user = Object.values(usersByToken).find(
            (u) => u._id.toString() === id,
          );
          if (!user) throw new NotFoundException('introuvable');
          return user;
        },
      } as never,
      new Reflector(),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [{ provide: LoansService, useValue: mocks.service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalGuards(jwtAuthGuard);
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('GET /loans : un utilisateur ne voit que ses prêts', async () => {
    mocks.loanModel.find.mock.mockImplementation(() => findQuery([]));
    mocks.loanModel.countDocuments.mock.mockImplementation(async () => 0);

    await request(app.getHttpServer())
      .get('/api/loans')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    const filter = mocks.loanModel.find.mock.calls.at(-1)?.arguments[0] as {
      borrowerId?: Types.ObjectId;
    };
    assert.deepEqual(filter.borrowerId, USER._id);
  });

  it('GET /loans : un responsable voit tous les prêts', async () => {
    await request(app.getHttpServer())
      .get('/api/loans')
      .set('Authorization', 'Bearer manager-token')
      .query({ status: 'OVERDUE', page: 1, limit: 50 })
      .expect(200);

    const filter = mocks.loanModel.find.mock.calls.at(-1)?.arguments[0] as {
      borrowerId?: Types.ObjectId;
    };
    assert.equal(filter.borrowerId, undefined);
  });

  it('POST /loans : crée un prêt pour l’utilisateur connecté', async () => {
    const loan = buildLoan();
    mocks.resourcesService.findOne.mock.mockImplementation(async () =>
      buildEquipment(),
    );
    mocks.loanModel.create.mock.mockImplementation(async () => loan);

    const response = await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', 'Bearer user-token')
      .send(validCreateBody())
      .expect(201);

    const created = mocks.loanModel.create.mock.calls.at(-1)?.arguments[0] as {
      borrowerId: Types.ObjectId;
    };
    assert.deepEqual(created.borrowerId, USER._id);
    assert.ok(response.body.id ?? response.body._id);
  });

  it('POST /loans/:id/return : 403 pour un utilisateur, 200 pour un responsable', async () => {
    const loan = buildLoan();
    mocks.loanModel.findById.mock.mockImplementation(async () => loan);

    await request(app.getHttpServer())
      .post(`/api/loans/${loan.id}/return`)
      .set('Authorization', 'Bearer user-token')
      .send({ conditionAtReturn: 'GOOD' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/loans/${loan.id}/return`)
      .set('Authorization', 'Bearer manager-token')
      .send({ conditionAtReturn: 'GOOD' })
      .expect(201);

    assert.equal(loan.status, LoanStatus.RETURNED);
  });

  it('rejette un body invalide avec 400', async () => {
    await request(app.getHttpServer())
      .post('/api/loans')
      .set('Authorization', 'Bearer user-token')
      .send({ dueAt: 'pas-une-date' })
      .expect(400);
  });

  it('renvoie 401 sans token', async () => {
    await request(app.getHttpServer()).get('/api/loans').expect(401);
  });
});
