/**
 * ============================================
 * EVENT-DRIVEN PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Event Emitter — decouple modules trong monolith
 * 2. CQRS — tách read/write models cho scalability
 * 3. Event Sourcing basics — lưu events thay vì state
 * 4. Domain Events — business logic trigger side effects
 * 5. Transactional Outbox — reliable event publishing
 * 6. Saga Pattern — manage distributed transactions
 */

// ═══════════════════════════════════════════
// Rule 1: NestJS Event Emitter
// ═══════════════════════════════════════════

// ❌ BAD: Service gọi trực tiếp các side effects → tight coupling
/*
@Injectable()
export class OrderService {
  constructor(
    private emailService: EmailService,
    private inventoryService: InventoryService,
    private analyticsService: AnalyticsService,
    private loyaltyService: LoyaltyService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(dto);

    // Tight coupling → thêm side effect = sửa OrderService
    await this.emailService.sendConfirmation(order);
    await this.inventoryService.reduceStock(order);
    await this.analyticsService.trackOrder(order);
    await this.loyaltyService.addPoints(order);

    return order;
  }
}
*/

// ✅ GOOD: Event-driven — publish event, listeners handle side effects

// Domain event definition
interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

class OrderCreatedEvent implements DomainEvent {
  readonly eventName = 'order.created';
  readonly occurredAt = new Date();

  constructor(readonly payload: {
    orderId: string;
    userId: string;
    items: { productId: string; quantity: number; price: number }[];
    total: number;
  }) {}
}

class OrderCancelledEvent implements DomainEvent {
  readonly eventName = 'order.cancelled';
  readonly occurredAt = new Date();

  constructor(readonly payload: {
    orderId: string;
    userId: string;
    reason: string;
    refundAmount: number;
  }) {}
}

class PaymentCompletedEvent implements DomainEvent {
  readonly eventName = 'payment.completed';
  readonly occurredAt = new Date();

  constructor(readonly payload: {
    orderId: string;
    transactionId: string;
    amount: number;
  }) {}
}

// Event-driven OrderService
/*
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(dto);

    // Publish event — listeners handle side effects
    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent({
        orderId: order.id,
        userId: dto.userId,
        items: dto.items,
        total: order.total,
      }),
    );

    return order; // OrderService chỉ biết tạo order, không biết gì về email/inventory/analytics
  }
}

// Listeners (separate files, separate responsibilities)
@Injectable()
export class OrderEmailListener {
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.emailService.sendOrderConfirmation(event.payload);
  }
}

@Injectable()
export class InventoryListener {
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    for (const item of event.payload.items) {
      await this.inventoryService.reduceStock(item.productId, item.quantity);
    }
  }
}

@Injectable()
export class AnalyticsListener {
  @OnEvent('order.created', { async: true })  // Non-blocking
  async trackOrder(event: OrderCreatedEvent): Promise<void> {
    await this.analyticsService.track('order_created', event.payload);
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2: CQRS (Command Query Responsibility Segregation)
// ═══════════════════════════════════════════

// ❌ BAD: Same model cho cả read và write → compromise trên cả 2
/*
@Injectable()
export class ProductService {
  // Write operations cần validation, business rules
  async create(dto: CreateProductDto): Promise<Product> { ... }

  // Read operations cần joins, aggregation → cùng model = không optimize được
  async getProductDetail(id: string): Promise<Product> {
    return this.repo.findOne({
      where: { id },
      relations: ['category', 'reviews', 'variants', 'images'],
    });
    // Heavy query cho mọi read request!
  }
}
*/

// ✅ GOOD: CQRS — separate models cho read/write

// Commands (Write side)
interface Command {
  readonly type: string;
}

class CreateProductCommand implements Command {
  readonly type = 'CreateProduct';
  constructor(
    readonly name: string,
    readonly price: number,
    readonly categoryId: string,
  ) {}
}

class UpdatePriceCommand implements Command {
  readonly type = 'UpdatePrice';
  constructor(
    readonly productId: string,
    readonly newPrice: number,
    readonly reason: string,
  ) {}
}

// Queries (Read side)
interface Query {
  readonly type: string;
}

class GetProductDetailQuery implements Query {
  readonly type = 'GetProductDetail';
  constructor(readonly productId: string) {}
}

class ListProductsQuery implements Query {
  readonly type = 'ListProducts';
  constructor(
    readonly page: number,
    readonly limit: number,
    readonly categoryId?: string,
    readonly search?: string,
  ) {}
}

/*
// Command handler (Write)
@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  async execute(command: CreateProductCommand): Promise<string> {
    // Validate, apply business rules, save
    const product = Product.create(command);
    await this.writeRepo.save(product);

    // Emit event → update read model
    this.eventBus.publish(new ProductCreatedEvent(product));

    return product.id;
  }
}

// Query handler (Read) — optimized read model
@QueryHandler(GetProductDetailQuery)
export class GetProductDetailHandler implements IQueryHandler<GetProductDetailQuery> {
  async execute(query: GetProductDetailQuery): Promise<ProductDetailView> {
    // Read from optimized view/materialized view
    return this.readRepo.findProductView(query.productId);
  }
}
*/

// ═══════════════════════════════════════════
// Rule 3: Event Sourcing Basics
// ═══════════════════════════════════════════

// Traditional: Store current state
// Event Sourcing: Store sequence of events → derive state

interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  version: number;
  occurredAt: Date;
}

// ✅ GOOD: Event-sourced Order aggregate
class OrderAggregate {
  private id = '';
  private status = '';
  private items: unknown[] = [];
  private total = 0;
  private events: StoredEvent[] = [];
  private version = 0;

  static create(orderId: string, userId: string, items: unknown[]): OrderAggregate {
    const order = new OrderAggregate();
    order.applyEvent({
      id: `evt_${Date.now()}`,
      aggregateId: orderId,
      aggregateType: 'Order',
      eventType: 'OrderCreated',
      payload: { userId, items },
      version: 1,
      occurredAt: new Date(),
    });
    return order;
  }

  confirm(transactionId: string): void {
    if (this.status !== 'pending') {
      throw new Error('Order can only be confirmed when pending');
    }
    this.applyEvent({
      id: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Order',
      eventType: 'OrderConfirmed',
      payload: { transactionId },
      version: this.version + 1,
      occurredAt: new Date(),
    });
  }

  cancel(reason: string): void {
    if (['delivered', 'cancelled'].includes(this.status)) {
      throw new Error('Cannot cancel order in current status');
    }
    this.applyEvent({
      id: `evt_${Date.now()}`,
      aggregateId: this.id,
      aggregateType: 'Order',
      eventType: 'OrderCancelled',
      payload: { reason },
      version: this.version + 1,
      occurredAt: new Date(),
    });
  }

  private applyEvent(event: StoredEvent): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.id = event.aggregateId;
        this.status = 'pending';
        this.items = event.payload.items as unknown[];
        break;

      case 'OrderConfirmed':
        this.status = 'confirmed';
        break;

      case 'OrderCancelled':
        this.status = 'cancelled';
        break;
    }

    this.version = event.version;
    this.events.push(event);
  }

  getUncommittedEvents(): StoredEvent[] {
    return [...this.events];
  }

  getState(): Record<string, unknown> {
    return { id: this.id, status: this.status, items: this.items, total: this.total, version: this.version };
  }
}

// ═══════════════════════════════════════════
// Rule 4: Transactional Outbox Pattern
// ═══════════════════════════════════════════

// Problem: DB save + event publish = 2 separate operations
// → DB saves but event publish fails → inconsistency!

// ✅ GOOD: Outbox table — save event atomically with business data
//
// // 1. Save order + outbox event in SAME transaction
// await queryRunner.startTransaction();
// try {
//   await queryRunner.manager.save(Order, order);
//   await queryRunner.manager.save(OutboxEvent, {
//     aggregateId: order.id,
//     eventType: 'order.created',
//     payload: JSON.stringify(orderData),
//     status: 'pending',
//     createdAt: new Date(),
//   });
//   await queryRunner.commitTransaction();
// } catch (error) {
//   await queryRunner.rollbackTransaction();
//   throw error;
// }
//
// // 2. Background worker polls outbox table and publishes events
// @Cron('*/5 * * * * *')  // Every 5 seconds
// async publishPendingEvents(): Promise<void> {
//   const events = await this.outboxRepo.find({
//     where: { status: 'pending' },
//     order: { createdAt: 'ASC' },
//     take: 100,
//   });
//
//   for (const event of events) {
//     try {
//       await this.messageBroker.publish(event.eventType, event.payload);
//       event.status = 'published';
//       event.publishedAt = new Date();
//     } catch (error) {
//       event.retryCount++;
//       if (event.retryCount >= 5) event.status = 'failed';
//     }
//     await this.outboxRepo.save(event);
//   }
// }

const outboxTableSchema = `
CREATE TABLE outbox_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id  VARCHAR(255) NOT NULL,
  event_type    VARCHAR(255) NOT NULL,
  payload       JSONB NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending',  -- pending, published, failed
  retry_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  published_at  TIMESTAMP
);

CREATE INDEX idx_outbox_pending ON outbox_events (status, created_at)
  WHERE status = 'pending';
`;

export {
  OrderCreatedEvent,
  OrderCancelledEvent,
  PaymentCompletedEvent,
  OrderAggregate,
  CreateProductCommand,
  UpdatePriceCommand,
  GetProductDetailQuery,
  ListProductsQuery,
  outboxTableSchema,
  type DomainEvent,
  type StoredEvent,
  type Command,
  type Query,
};
