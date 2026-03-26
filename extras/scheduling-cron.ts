/**
 * ============================================
 * SCHEDULING & CRON PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. NestJS @Cron decorator — scheduled tasks
 * 2. Distributed lock — chỉ 1 instance chạy job
 * 3. Job monitoring — track success/failure
 * 4. Graceful shutdown — chờ job hoàn thành
 * 5. Dynamic scheduling — thêm/xóa jobs runtime
 * 6. Error handling — retry, alert nếu job fail
 */

// ═══════════════════════════════════════════
// Rule 1: NestJS Cron Basics
// ═══════════════════════════════════════════

// ❌ BAD: setInterval trong code
/*
setInterval(async () => {
  await cleanupExpiredSessions();
}, 60 * 60 * 1000);
// Không shutdown-safe, không monitor, không distributed
*/

// ✅ GOOD: NestJS Schedule decorator
const cronBasicExample = `
@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  // Chạy mỗi ngày lúc 2:00 AM
  @Cron('0 2 * * *', { name: 'cleanup-sessions' })
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting session cleanup...');
    const deleted = await this.sessionRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    this.logger.log(\`Cleaned up \${deleted.affected} expired sessions\`);
  }

  // Chạy mỗi 5 phút
  @Cron('*/5 * * * *', { name: 'sync-inventory' })
  async syncInventory(): Promise<void> {
    await this.inventoryService.syncWithWarehouse();
  }

  // Chạy Thứ 2 hàng tuần lúc 9:00 AM
  @Cron('0 9 * * 1', { name: 'weekly-report' })
  async generateWeeklyReport(): Promise<void> {
    await this.reportService.generateAndSend();
  }
}
`;

// Cron syntax reference
const CRON_SYNTAX = {
  format: '┌────────── second (0-59, optional)',
  fields: [
    '│ ┌──────── minute (0-59)',
    '│ │ ┌────── hour (0-23)',
    '│ │ │ ┌──── day of month (1-31)',
    '│ │ │ │ ┌── month (1-12)',
    '│ │ │ │ │ ┌ day of week (0-7, 0=7=Sunday)',
    '│ │ │ │ │ │',
    '* * * * * *',
  ],
  examples: {
    'every_minute': '* * * * *',
    'every_5_minutes': '*/5 * * * *',
    'every_hour': '0 * * * *',
    'daily_midnight': '0 0 * * *',
    'daily_2am': '0 2 * * *',
    'weekly_monday_9am': '0 9 * * 1',
    'monthly_first_day': '0 0 1 * *',
    'weekdays_9am': '0 9 * * 1-5',
  },
};

// ═══════════════════════════════════════════
// Rule 2: Distributed Lock
// ═══════════════════════════════════════════

// Problem: 3 instances → cron runs 3 times!
// Solution: Distributed lock (Redis)

// ✅ GOOD: Only 1 instance runs the job
class DistributedLock {
  constructor(private readonly prefix: string = 'lock') {}

  async acquireLock(
    key: string,
    ttlSeconds: number,
    redis: { set: (k: string, v: string, mode: string, duration: number) => Promise<string | null> },
  ): Promise<boolean> {
    const lockKey = `${this.prefix}:${key}`;
    const result = await redis.set(lockKey, '1', 'EX', ttlSeconds);
    return result === 'OK';
  }

  async releaseLock(
    key: string,
    redis: { del: (k: string) => Promise<number> },
  ): Promise<void> {
    await redis.del(`${this.prefix}:${key}`);
  }
}

// Usage pattern
const distributedCronExample = `
@Cron('0 2 * * *')
async cleanupWithLock(): Promise<void> {
  const lockKey = 'cron:cleanup-sessions';
  const locked = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');

  if (!locked) {
    this.logger.debug('Another instance is running this job');
    return;
  }

  try {
    await this.cleanupExpiredSessions();
  } finally {
    await this.redis.del(lockKey);
  }
}
`;

// ═══════════════════════════════════════════
// Rule 3: Job Monitoring
// ═══════════════════════════════════════════

// ✅ GOOD: Track job execution
interface JobExecution {
  jobName: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'success' | 'failed';
  duration?: number;
  error?: string;
  itemsProcessed?: number;
}

class JobMonitor {
  private executions: JobExecution[] = [];

  async trackJob(
    jobName: string,
    fn: () => Promise<{ itemsProcessed?: number }>,
  ): Promise<void> {
    const execution: JobExecution = {
      jobName,
      startedAt: new Date(),
      status: 'running',
    };
    this.executions.push(execution);

    try {
      const result = await fn();
      execution.status = 'success';
      execution.itemsProcessed = result.itemsProcessed;
    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;

      // Alert on failure
      console.error(`[JobMonitor] Job '${jobName}' failed: ${execution.error}`);
    } finally {
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
    }

    // Keep only last 100 executions per job
    this.cleanupHistory();
  }

  getHistory(jobName?: string): JobExecution[] {
    if (jobName) {
      return this.executions.filter(e => e.jobName === jobName);
    }
    return this.executions;
  }

  private cleanupHistory(): void {
    if (this.executions.length > 500) {
      this.executions = this.executions.slice(-500);
    }
  }
}

// ═══════════════════════════════════════════
// Rule 4: Graceful Shutdown
// ═══════════════════════════════════════════

// ✅ GOOD: Wait for running jobs before shutdown
const gracefulShutdownExample = `
@Injectable()
export class ScheduleService implements OnModuleDestroy {
  private runningJobs = new Set<string>();

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down scheduler...');

    // Wait for running jobs (max 30s)
    const timeout = 30_000;
    const start = Date.now();

    while (this.runningJobs.size > 0 && Date.now() - start < timeout) {
      this.logger.log(\`Waiting for \${this.runningJobs.size} jobs to complete...\`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningJobs.size > 0) {
      this.logger.warn(\`Force shutdown with \${this.runningJobs.size} jobs still running\`);
    }
  }

  async executeJob(name: string, fn: () => Promise<void>): Promise<void> {
    this.runningJobs.add(name);
    try {
      await fn();
    } finally {
      this.runningJobs.delete(name);
    }
  }
}
`;

// ═══════════════════════════════════════════
// Rule 5: Best Practices
// ═══════════════════════════════════════════

const SCHEDULING_BEST_PRACTICES = {
  do: [
    'Distributed lock cho multi-instance environments',
    'Monitor job execution (duration, success/fail, items processed)',
    'Graceful shutdown — chờ jobs hoàn thành',
    'Idempotent jobs — chạy lại an toàn nếu fail',
    'Stagger cron times — tránh tất cả jobs chạy cùng lúc',
    'Log đầy đủ: start, items processed, duration, errors',
  ],
  dont: [
    'Dùng setInterval/setTimeout cho scheduled tasks',
    'Chạy heavy jobs trên API instance — dùng worker riêng',
    'Ignore failures — phải alert khi job fail liên tục',
    'Hardcode schedule — dùng config/env vars',
    'Chạy job quá lâu — timeout + chunking',
  ],
};

export {
  DistributedLock,
  JobMonitor,
  cronBasicExample,
  distributedCronExample,
  gracefulShutdownExample,
  CRON_SYNTAX,
  SCHEDULING_BEST_PRACTICES,
  type JobExecution,
};
