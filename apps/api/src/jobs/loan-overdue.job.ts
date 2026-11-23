import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoansService } from '../modules/loans/loans.service';
import { RedisLockService } from './redis-lock.service';

// Le TTL doit rester inférieur à l'intervalle du cron pour ne pas sauter de cycle.
const LOCK_TTL_MS = 10 * 60 * 1000;
const LOCK_KEY = 'loan-overdue';

@Injectable()
export class LoanOverdueJob {
  private readonly logger = new Logger(LoanOverdueJob.name);

  constructor(
    private readonly loansService: LoansService,
    private readonly lockService: RedisLockService,
  ) {}

  @Cron(process.env.OVERDUE_CRON ?? '*/15 * * * *')
  async run(): Promise<void> {
    const token = await this.lockService.acquire(LOCK_KEY, LOCK_TTL_MS);
    if (!token) {
      return;
    }
    try {
      const result = await this.loansService.markOverdueLoans(new Date());
      this.logger.log(
        `Prêts en retard : ${result.marked} passé(s) OVERDUE, ${result.notified} notification(s)`,
      );
    } catch (error) {
      this.logger.error(
        'Échec du traitement des prêts en retard',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await this.lockService.release(LOCK_KEY, token);
    }
  }
}
