import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoansService } from '../modules/loans/loans.service';
import { RedisLockService } from './redis-lock.service';

const LOCK_TTL_MS = 30 * 60 * 1000;
const LOCK_KEY = 'loan-reminder';
const DEFAULT_REMINDER_HOURS = 24;

@Injectable()
export class LoanReminderJob {
  private readonly logger = new Logger(LoanReminderJob.name);

  constructor(
    private readonly loansService: LoansService,
    private readonly lockService: RedisLockService,
  ) {}

  @Cron(process.env.REMINDER_CRON ?? '0 * * * *')
  async run(): Promise<void> {
    const token = await this.lockService.acquire(LOCK_KEY, LOCK_TTL_MS);
    if (!token) {
      return;
    }
    try {
      const hours = this.reminderHours();
      const reminded = await this.loansService.findDueSoon(new Date(), hours);
      this.logger.log(`${reminded.length} rappel(s) d'échéance envoyé(s)`);
    } catch (error) {
      this.logger.error(
        'Échec des rappels d\'échéance',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await this.lockService.release(LOCK_KEY, token);
    }
  }

  private reminderHours(): number {
    const parsed = Number(process.env.LOAN_REMINDER_HOURS);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_REMINDER_HOURS;
  }
}
