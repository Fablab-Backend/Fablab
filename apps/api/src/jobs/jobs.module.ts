import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoansModule } from '../modules/loans/loans.module';
import { RedisLockService } from './redis-lock.service';
import { LoanOverdueJob } from './loan-overdue.job';
import { LoanReminderJob } from './loan-reminder.job';

@Module({
  imports: [ScheduleModule.forRoot(), LoansModule],
  providers: [RedisLockService, LoanOverdueJob, LoanReminderJob],
})
export class JobsModule {}
