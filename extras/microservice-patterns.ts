/**
 * ============================================
 * MICROSERVICE PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Service Communication — sync (HTTP/gRPC) vs async (message queue)
 * 2. API Gateway — single entry point
 * 3. Service Discovery — tự tìm nhau
 * 4. Data Consistency — saga, eventual consistency
 * 5. Resilience — circuit breaker, bulkhead, timeout
 * 6. Observability — distributed tracing, centralized logging
 */

// ═══════════════════════════════════════════
// Rule 1: Communication Patterns
// ═══════════════════════════════════════════

// ❌ BAD: Synchronous chain calls → cascading failures
/*
// OrderService → PaymentService → InventoryService → NotificationService
// Nếu NotificationService chết → tất cả timeout → chain failure!
*/

// ✅ GOOD: Async communication qua message broker
/*
// OrderService:
await this.messageBroker.publish('order.created', { orderId, items, total });

// PaymentService (subscriber):
@EventPattern('order.created')
handleOrderCreated(data: OrderCreatedEvent) {
  await this.processPayment(data);
  await this.messageBroker.publish('payment.completed', { orderId, transactionId });
}

// InventoryService (subscriber):
@EventPattern('payment.completed')
handlePaymentCompleted(data: PaymentCompletedEvent) {
  await this.reduceStock(data.orderId);
}
*/

// Communication comparison table
const COMMUNICATION_PATTERNS = {
  synchronous: {
    protocols: ['HTTP/REST', 'gRPC'],
    useCases: [
      'Query data from another service (read)',
      'Need immediate response',
      'Simple request-reply',
    ],
    pros: ['Simple', 'Immediate response', 'Easy debugging'],
    cons: ['Tight coupling', 'Cascading failures', 'Latency accumulation'],
  },
  asynchronous: {
    protocols: ['RabbitMQ', 'Kafka', 'Redis Pub/Sub', 'NATS'],
    useCases: [
      'Fire-and-forget (notifications)',
      'Event broadcasting',
      'Long-running processes',
      'Decoupled workflows',
    ],
    pros: ['Loose coupling', 'Resilient', 'Scalable', 'Buffer peaks'],
    cons: ['Complex debugging', 'Eventual consistency', 'Message ordering'],
  },
};

// ═══════════════════════════════════════════
// Rule 2: API Gateway Pattern
// ═══════════════════════════════════════════

// ✅ GOOD: Gateway aggregates responses from multiple services
/*
// Client → API Gateway → [UserService, OrderService, ProductService]

@Controller('gateway')
export class GatewayController {
  constructor(
    private readonly userClient: ClientProxy,
    private readonly orderClient: ClientProxy,
  ) {}

  @Get('users/:id/dashboard')
  async getUserDashboard(@Param('id') userId: string) {
    // Parallel calls to multiple services
    const [user, orders, notifications] = await Promise.all([
      firstValueFrom(this.userClient.send('get-user', { userId })),
      firstValueFrom(this.orderClient.send('get-user-orders', { userId })),
      firstValueFrom(this.userClient.send('get-notifications', { userId })),
    ]);

    return { user, recentOrders: orders, notifications };
  }
}
*/

// Gateway responsibilities
const API_GATEWAY_RESPONSIBILITIES = [
  'Request routing — route to correct service',
  'Authentication — verify JWT, attach user context',
  'Rate limiting — protect backend services',
  'Response aggregation — combine multiple service calls',
  'Protocol translation — REST ↔ gRPC ↔ WebSocket',
  'Caching — cache frequent queries at gateway',
  'Load balancing — distribute across service instances',
  'Circuit breaking — fail fast when service is down',
];

// ═══════════════════════════════════════════
// Rule 3: NestJS Microservice Setup
// ═══════════════════════════════════════════

// ✅ GOOD: NestJS microservice transport
const nestjsMicroserviceSetup = `
// main.ts — Microservice app
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'orders_queue',
    queueOptions: { durable: true },
    noAck: false,  // Manual acknowledgment
  },
});

// Hybrid app — HTTP + Microservice
const app = await NestFactory.create(AppModule);
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL],
    queue: 'orders_queue',
  },
});
await app.startAllMicroservices();
await app.listen(3000);
`;

// ═══════════════════════════════════════════
// Rule 4: Message Patterns
// ═══════════════════════════════════════════

// ✅ GOOD: Request-Response vs Event-Based
const messagePatternExample = `
// ── Request-Response (sync-like over message broker) ──
// Client side:
const user = await firstValueFrom(
  this.userClient.send('get-user', { userId: '123' }),
);

// Server side:
@MessagePattern('get-user')
async getUser(@Payload() data: { userId: string }): Promise<User> {
  return this.userService.findById(data.userId);
}

// ── Event-Based (fire-and-forget) ──
// Publisher:
this.orderClient.emit('order.created', { orderId: '456', total: 99.99 });

// Subscriber:
@EventPattern('order.created')
async handleOrderCreated(@Payload() data: OrderCreatedEvent): Promise<void> {
  await this.processOrder(data);
}
`;

// ═══════════════════════════════════════════
// Rule 5: Resilience Patterns
// ═══════════════════════════════════════════

// ✅ GOOD: Bulkhead pattern — isolate failures
class BulkheadExecutor {
  private activeCount = 0;
  private queue: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void; fn: () => Promise<unknown> }> = [];

  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number = 10,
    private readonly maxQueue: number = 50,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error(`Bulkhead '${this.name}' queue full (${this.maxQueue})`);
      }

      return new Promise<T>((resolve, reject) => {
        this.queue.push({ resolve: resolve as (v: unknown) => void, reject, fn: fn as () => Promise<unknown> });
      });
    }

    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const { resolve, reject, fn } = this.queue.shift()!;
      this.run(fn).then(resolve).catch(reject);
    }
  }
}

// ═══════════════════════════════════════════
// Rule 6: Service Decomposition Guidelines
// ═══════════════════════════════════════════

const DECOMPOSITION_GUIDELINES = {
  splitWhen: [
    'Team ownership — different teams own different domains',
    'Independent scaling — one service needs 10x more instances',
    'Technology diversity — different tech stack needed',
    'Deployment independence — deploy without affecting others',
    'Data isolation — compliance requires separate databases',
  ],
  keepTogether: [
    'Tight coupling — services always change together',
    'Shared data — services frequently JOIN across boundaries',
    'Small team — overhead > benefit',
    'Low traffic — single service handles load fine',
    'Early stage — boundaries not clear yet → premature split',
  ],
  commonServices: [
    'User Service — auth, profiles, roles',
    'Order Service — cart, checkout, order lifecycle',
    'Product Service — catalog, search, inventory',
    'Payment Service — transactions, refunds, invoicing',
    'Notification Service — email, SMS, push',
    'File Service — upload, storage, CDN',
    'Analytics Service — events, reports, dashboards',
  ],
};

export {
  BulkheadExecutor,
  COMMUNICATION_PATTERNS,
  API_GATEWAY_RESPONSIBILITIES,
  DECOMPOSITION_GUIDELINES,
  nestjsMicroserviceSetup,
  messagePatternExample,
};
