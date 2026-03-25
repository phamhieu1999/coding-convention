/**
 * ============================================
 * PERFORMANCE #2: QUEUE PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Queue cho heavy/async tasks — không block request
 * 2. BullMQ + Redis cho job queue
 * 3. Retry strategy + exponential backoff
 * 4. Dead letter queue (DLQ) cho failed jobs
 * 5. Concurrency control — tránh quá tải worker
 * 6. Job priority + delayed jobs
 */

// ═══════════════════════════════════════════
// Rule 2.1: Offload Heavy Work to Queue
// ═══════════════════════════════════════════

// ❌ BAD: Gửi email ngay trong request → response chậm
/*
@Post('orders')
async createOrder(@Body() dto: CreateOrderDto) {
  const order = await this.orderService.create(dto);

  // Block 2-5 seconds gửi email!
  await this.emailService.sendOrderConfirmation(order);
  await this.pdfService.generateInvoice(order);
  await this.notificationService.notifyPartner(order);

  return order;  // User đợi 5-10s cho 1 request
}
*/

// ✅ GOOD: Queue processing → response ngay lập tức
/*
@Post('orders')
async createOrder(@Body() dto: CreateOrderDto) {
  const order = await this.orderService.create(dto);

  // Queue async tasks — response ngay < 100ms
  await this.orderQueue.add('send-confirmation', {
    orderId: order.id,
    email: dto.email,
  });

  await this.orderQueue.add('generate-invoice', {
    orderId: order.id,
  });

  return order;  // Respond immediately!
}
*/

// ═══════════════════════════════════════════
// Rule 2.2: BullMQ Producer Setup
// ═══════════════════════════════════════════

// ✅ GOOD: Module registration
/*
// order-queue.module.ts
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,   // 2s → 4s → 8s
        },
        removeOnComplete: { age: 3600 },  // Cleanup after 1 hour
        removeOnFail: { age: 86400 },      // Keep failed 24h for debugging
      },
    }),
  ],
  providers: [OrderQueueProducer, OrderQueueConsumer],
  exports: [OrderQueueProducer],
})
export class OrderQueueModule {}
*/

// ═══════════════════════════════════════════
// Rule 2.3: Queue Producer — Job Dispatching
// ═══════════════════════════════════════════

// ❌ BAD: Không cấu trúc, không priority
/*
await queue.add('process', data);
*/

// ✅ GOOD: Structured producer với priority + delay

interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
}

interface OrderJobData {
  orderId: string;
  email?: string;
  type: 'confirmation' | 'invoice' | 'notification';
}

class OrderQueueProducer {
  constructor(private readonly orderQueue: any) {}

  async addConfirmationEmail(orderId: string, email: string): Promise<void> {
    await this.orderQueue.add(
      'send-confirmation',
      { orderId, email, type: 'confirmation' } satisfies OrderJobData,
      {
        priority: 1,         // High priority
        attempts: 5,         // Email quan trọng → retry nhiều
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  async addInvoiceGeneration(orderId: string): Promise<void> {
    await this.orderQueue.add(
      'generate-invoice',
      { orderId, type: 'invoice' } satisfies OrderJobData,
      {
        priority: 3,         // Lower priority
        delay: 5000,         // Delay 5s — đợi order confirmed
      },
    );
  }

  async addBulkNotifications(orderIds: string[]): Promise<void> {
    const jobs = orderIds.map(orderId => ({
      name: 'notify-partner',
      data: { orderId, type: 'notification' as const },
      opts: { priority: 5 },
    }));

    // Bulk add — efficient cho batch operations
    await this.orderQueue.addBulk(jobs);
  }
}

// ═══════════════════════════════════════════
// Rule 2.4: Queue Consumer — Job Processing
// ═══════════════════════════════════════════

// ❌ BAD: Không handle error, không log, không idempotent
/*
@Process('send-confirmation')
async handleConfirmation(job) {
  await this.emailService.send(job.data.email, 'Order confirmed');
}
*/

// ✅ GOOD: Robust consumer với error handling + idempotency
/*
@Processor('order')
export class OrderQueueConsumer {
  private readonly logger = new Logger(OrderQueueConsumer.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly invoiceService: InvoiceService,
    private readonly orderRepo: OrderRepository,
  ) {}

  @Process({ name: 'send-confirmation', concurrency: 5 })
  async handleConfirmation(job: Job<OrderJobData>): Promise<void> {
    const { orderId, email } = job.data;
    this.logger.log(`Processing confirmation for order ${orderId}`);

    // Idempotency check — đã gửi rồi thì skip
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (order?.confirmationSentAt) {
      this.logger.warn(`Confirmation already sent for ${orderId}, skipping`);
      return;
    }

    await this.emailService.sendOrderConfirmation(email!, orderId);

    // Mark as sent
    await this.orderRepo.update(orderId, {
      confirmationSentAt: new Date(),
    });

    this.logger.log(`Confirmation sent for order ${orderId}`);
  }

  @Process({ name: 'generate-invoice', concurrency: 2 })
  async handleInvoice(job: Job<OrderJobData>): Promise<void> {
    const { orderId } = job.data;

    // Progress reporting cho long-running jobs
    await job.updateProgress(10);
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'customer'],
    });

    await job.updateProgress(50);
    await this.invoiceService.generate(order!);

    await job.updateProgress(100);
  }

  // Event handlers
  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.name}:${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`,
      error.stack,
    );

    // Alert khi đã hết retry
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      this.alertDeadLetter(job, error);
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Job ${job.name}:${job.id} completed`);
  }

  private alertDeadLetter(job: Job, error: Error): void {
    this.logger.error(`DEAD LETTER: Job ${job.name}:${job.id} exhausted all retries`, {
      jobData: job.data,
      error: error.message,
      attempts: job.attemptsMade,
    });
    // Send alert to Slack/PagerDuty
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.5: Queue Configuration Best Practices
// ═══════════════════════════════════════════

// ✅ GOOD: Centralized queue config

const QUEUE_CONFIG = {
  order: {
    name: 'order',
    concurrency: 5,
    defaultAttempts: 3,
    backoff: { type: 'exponential' as const, delay: 2_000 },
  },
  email: {
    name: 'email',
    concurrency: 10,
    defaultAttempts: 5,
    backoff: { type: 'exponential' as const, delay: 3_000 },
  },
  report: {
    name: 'report',
    concurrency: 2,          // Heavy work → limit concurrency
    defaultAttempts: 2,
    backoff: { type: 'fixed' as const, delay: 10_000 },
  },
  notification: {
    name: 'notification',
    concurrency: 20,         // Lightweight → high concurrency
    defaultAttempts: 3,
    backoff: { type: 'exponential' as const, delay: 1_000 },
  },
} as const;

// ═══════════════════════════════════════════
// Rule 2.6: Scheduled / Cron Jobs
// ═══════════════════════════════════════════

// ✅ GOOD: Repeatable jobs thay vì setInterval
/*
// Thêm khi app bootstrap
await orderQueue.add(
  'cleanup-expired-orders',
  {},
  {
    repeat: {
      pattern: '0 2 * * *',     // Every day at 2 AM
    },
    jobId: 'cleanup-expired',    // Prevent duplicates
  },
);

await reportQueue.add(
  'daily-revenue-report',
  {},
  {
    repeat: {
      pattern: '0 8 * * 1-5',   // Weekdays at 8 AM
    },
    jobId: 'daily-revenue',
  },
);
*/

export {
  OrderQueueProducer,
  QUEUE_CONFIG,
  type OrderJobData,
  type JobOptions,
};
