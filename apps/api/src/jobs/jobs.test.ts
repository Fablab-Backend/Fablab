import 'reflect-metadata';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import type { Redis } from 'ioredis';
import { NotificationType } from '../modules/notifications/notifications.model';
import { LoanStatus, EquipmentCondition } from '../modules/loans/loans.model';
import { LoansService } from '../modules/loans/loans.service';
import { RedisLockService } from './redis-lock.service';
import { LoanOverdueJob } from './loan-overdue.job';
import { LoanReminderJob } from './loan-reminder.job';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function buildLoan(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    equipmentId: new Types.ObjectId(),
    borrowerId: new Types.ObjectId(),
    status: LoanStatus.ACTIVE,
    borrowedAt: new Date(Date.now() - DAY_MS),
    dueAt: new Date(Date.now() - HOUR_MS),
    conditionAtLoan: EquipmentCondition.GOOD,
    ...overrides,
  };
}

function makeService() {
  const loanModel = {
    find: mock.fn<(filter?: unknown) => Promise<unknown[]>>(async () => []),
    updateOne: mock.fn<
      (filter?: unknown, update?: unknown) => Promise<{ modifiedCount: number }>
    >(async () => ({ modifiedCount: 1 })),
  };
  const resourcesService = { findOne: mock.fn(async () => ({})) };
  const notificationsService = {
    notify: mock.fn<(input?: Record<string, unknown>) => Promise<unknown>>(
      async () => ({}),
    ),
  };
  const usersService = {
    findAll: mock.fn<
      (query?: Record<string, unknown>) => Promise<{ items: { id: string }[] }>
    >(async () => ({ items: [{ id: new Types.ObjectId().toHexString() }] })),
  };
  const auditService = {
    log: mock.fn<(entry?: Record<string, unknown>) => Promise<void>>(
      async () => {},
    ),
  };

  const service = new LoansService(
    loanModel as never,
    resourcesService as never,
    notificationsService as never,
    usersService as never,
    auditService as never,
  );
  return {
    service,
    loanModel,
    notificationsService,
    usersService,
  };
}

type NotifyMock = ReturnType<typeof makeService>['notificationsService']['notify'];

function notifyTypes(notify: NotifyMock): unknown[] {
  return notify.mock.calls.map(
    (call) => (call.arguments[0] as { type?: unknown } | undefined)?.type,
  );
}

describe('LoansService.markOverdueLoans', () => {
  it('passe un prêt ACTIVE échu en OVERDUE et notifie une seule fois', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const loan = buildLoan({ status: LoanStatus.ACTIVE });
    loanModel.find.mock.mockImplementation(async () => [loan]);

    const result = await service.markOverdueLoans(new Date());

    assert.equal(result.marked, 1);
    assert.equal(result.notified, 1);
    const statusUpdate = loanModel.updateOne.mock.calls.find(
      (call) =>
        (call.arguments[1] as { $set?: { status?: string } } | undefined)
          ?.$set?.status === LoanStatus.OVERDUE,
    );
    assert.ok(statusUpdate, 'le statut OVERDUE doit être posé');
    const types = notifyTypes(notificationsService.notify);
    // 1 emprunteur + 1 responsable (un seul rôle mocké avec un manager)
    assert.ok(types.includes(NotificationType.LOAN_OVERDUE));
  });

  it('ne renotifie pas un prêt déjà notifié récemment', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const loan = buildLoan({
      status: LoanStatus.OVERDUE,
      overdueNotifiedAt: new Date(Date.now() - HOUR_MS),
    });
    loanModel.find.mock.mockImplementation(async () => [loan]);

    const result = await service.markOverdueLoans(new Date());

    assert.equal(result.notified, 0);
    assert.equal(notificationsService.notify.mock.calls.length, 0);
  });

  it('renotifie un prêt toujours en retard après 24 h', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const loan = buildLoan({
      status: LoanStatus.OVERDUE,
      overdueNotifiedAt: new Date(Date.now() - DAY_MS - HOUR_MS),
    });
    loanModel.find.mock.mockImplementation(async () => [loan]);

    const result = await service.markOverdueLoans(new Date());

    assert.equal(result.notified, 1);
    assert.ok(
      notifyTypes(notificationsService.notify).includes(NotificationType.LOAN_OVERDUE),
    );
  });

  it('ne touche jamais un prêt RETURNED (filtre de recherche)', async () => {
    const { service, loanModel } = makeService();
    await service.markOverdueLoans(new Date());

    const filter = loanModel.find.mock.calls[0]?.arguments[0] as {
      status?: { $in?: string[] };
    };
    assert.deepEqual(filter.status?.$in?.sort(), [
      LoanStatus.ACTIVE,
      LoanStatus.OVERDUE,
    ]);
    assert.ok(!filter.status?.$in?.includes(LoanStatus.RETURNED));
  });

  it('continue les autres prêts si l\'un d\'eux échoue', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const ko = buildLoan({ status: LoanStatus.ACTIVE });
    const ok = buildLoan({ status: LoanStatus.ACTIVE });
    loanModel.find.mock.mockImplementation(async () => [ko, ok]);
    loanModel.updateOne.mock.mockImplementation(
      async (filter?: unknown) => {
        const f = filter as { _id?: Types.ObjectId };
        if (f._id?.equals(ko._id)) {
          throw new Error('mongo down');
        }
        return { modifiedCount: 1 };
      },
    );

    const result = await service.markOverdueLoans(new Date());

    assert.equal(result.marked, 1);
    assert.ok(
      notifyTypes(notificationsService.notify).includes(NotificationType.LOAN_OVERDUE),
    );
  });
});

describe('LoansService.findDueSoon', () => {
  it('envoie LOAN_REMINDER une seule fois dans la fenêtre', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const loan = buildLoan({
      status: LoanStatus.ACTIVE,
      dueAt: new Date(Date.now() + 12 * HOUR_MS),
    });
    loanModel.find.mock.mockImplementation(async () => [loan]);

    const reminded = await service.findDueSoon(new Date(), 24);

    assert.equal(reminded.length, 1);
    // Seul l'emprunteur est notifié pour un rappel.
    assert.equal(notificationsService.notify.mock.calls.length, 1);
    const types = notifyTypes(notificationsService.notify);
    assert.ok(types.includes(NotificationType.LOAN_REMINDER));
    // Le filtre exige reminderSentAt null : un second passage ne renverra rien.
    const filter = loanModel.find.mock.calls[0]?.arguments[0] as Record<
      string,
      unknown
    >;
    assert.equal(filter.reminderSentAt, null);
  });

  it('borne la fenêtre à now + hours', async () => {
    const { service, loanModel } = makeService();
    const now = new Date();
    await service.findDueSoon(now, 24);

    const filter = loanModel.find.mock.calls[0]?.arguments[0] as {
      dueAt?: { $gt?: Date; $lte?: Date };
    };
    assert.ok(filter.dueAt?.$gt instanceof Date);
    assert.ok(filter.dueAt?.$lte instanceof Date);
    assert.equal(
      (filter.dueAt?.$lte as Date).getTime() - now.getTime(),
      24 * HOUR_MS,
    );
  });

  it('ne notifie personne hors fenêtre (aucun prêt retourné)', async () => {
    const { service, notificationsService } = makeService();
    const reminded = await service.findDueSoon(new Date(), 24);
    assert.equal(reminded.length, 0);
    assert.equal(notificationsService.notify.mock.calls.length, 0);
  });

  it('traite les autres prêts si la notification de l\'un échoue', async () => {
    const { service, loanModel, notificationsService } = makeService();
    const ko = buildLoan({ dueAt: new Date(Date.now() + 2 * HOUR_MS) });
    const ok = buildLoan({ dueAt: new Date(Date.now() + 3 * HOUR_MS) });
    loanModel.find.mock.mockImplementation(async () => [ko, ok]);
    notificationsService.notify.mock.mockImplementation(
      async (input?: Record<string, unknown>) => {
        if ((input as { userId?: string })?.userId === ko.borrowerId.toHexString()) {
          throw new Error('smtp down');
        }
        return {};
      },
    );

    const reminded = await service.findDueSoon(new Date(), 24);

    assert.equal(reminded.length, 2);
    assert.equal(notificationsService.notify.mock.calls.length, 2);
  });
});

describe('Jobs planifiés', () => {
  it('LoanOverdueJob ne fait rien si le verrou est déjà pris', async () => {
    const loansService = {
      markOverdueLoans: mock.fn(async () => ({ marked: 0, notified: 0 })),
    };
    const lockService = {
      acquire: mock.fn(async () => null),
      release: mock.fn(async () => {}),
    };
    const job = new LoanOverdueJob(loansService as never, lockService as never);

    await job.run();

    assert.equal(loansService.markOverdueLoans.mock.calls.length, 0);
    assert.equal(lockService.release.mock.calls.length, 0);
  });

  it('LoanOverdueJob exécute le service puis libère le verrou', async () => {
    const loansService = {
      markOverdueLoans: mock.fn<
        (now?: Date) => Promise<{ marked: number; notified: number }>
      >(async () => ({ marked: 2, notified: 1 })),
    };
    const lockService = {
      acquire: mock.fn<(key?: string, ttl?: number) => Promise<string | null>>(
        async () => 'token-1',
      ),
      release: mock.fn<(key?: string, token?: string) => Promise<void>>(
        async () => {},
      ),
    };
    const job = new LoanOverdueJob(loansService as never, lockService as never);

    await job.run();

    assert.equal(loansService.markOverdueLoans.mock.calls.length, 1);
    assert.deepEqual(
      [...lockService.release.mock.calls[0]!.arguments],
      ['loan-overdue', 'token-1'],
    );
  });

  it('LoanReminderJob ne fait rien si le verrou est déjà pris', async () => {
    const loansService = {
      findDueSoon: mock.fn(async () => []),
    };
    const lockService = {
      acquire: mock.fn(async () => null),
      release: mock.fn(async () => {}),
    };
    const job = new LoanReminderJob(loansService as never, lockService as never);

    await job.run();

    assert.equal(loansService.findDueSoon.mock.calls.length, 0);
  });
});

describe('RedisLockService', () => {
  it('renvoie null sans exception quand REDIS_URL est absente', async () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const lock = new RedisLockService();
      assert.equal(await lock.acquire('test', 1000), null);
      await lock.release('test', 'token'); // ne doit pas lever
    } finally {
      if (previous !== undefined) {
        process.env.REDIS_URL = previous;
      }
    }
  });

  it('renvoie null sans exception quand Redis est en panne', async () => {
    const previous = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6390';
    class FailingLock extends RedisLockService {
      protected override createClient(): Redis {
        return {
          status: 'ready',
          on: () => undefined,
          connect: async () => undefined,
          set: async () => {
            throw new Error('connection refused');
          },
          eval: async () => 0,
        } as unknown as Redis;
      }
    }
    try {
      const lock = new FailingLock();
      assert.equal(await lock.acquire('test', 1000), null);
    } finally {
      if (previous !== undefined) {
        process.env.REDIS_URL = previous;
      } else {
        delete process.env.REDIS_URL;
      }
    }
  });
});
