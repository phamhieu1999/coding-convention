/**
 * ============================================
 * NESTJS CONVENTION #3: SERVICE PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Service chứa business logic — single responsibility
 * 2. Transaction handling đúng cách
 * 3. Service composition thay vì god service
 * 4. Interface-based dependency injection
 * 5. Không gọi HTTP/external service trực tiếp — dùng adapter
 * 6. Error handling rõ ràng, domain-specific exceptions
 */

// ═══════════════════════════════════════════
// Rule 3.1: Single Responsibility Service
// ═══════════════════════════════════════════

// ❌ BAD: God Service — làm mọi thứ
class OrderService_BAD {
  async createOrder(data: any): Promise<any> {
    // Validate stock
    // Calculate total
    // Apply discount
    // Process payment
    // Send email
    // Update inventory
    // Create shipping label
    // Log analytics
    // ... 200+ lines
    return data;
  }
}

// ✅ GOOD: Tách thành các service nhỏ, compose lại
interface IInventoryService {
  validateStock(items: OrderItemInput[]): Promise<void>;
  decreaseStock(items: OrderItemInput[]): Promise<void>;
}

interface IPricingService {
  calculateTotal(items: OrderItemInput[], couponCode?: string): Promise<PricingResult>;
}

interface IPaymentService {
  processPayment(amount: number, method: string): Promise<PaymentResult>;
}

interface INotificationService {
  sendOrderConfirmation(orderId: string, email: string): Promise<void>;
}

interface OrderItemInput {
  productId: string;
  quantity: number;
}

interface PricingResult {
  subtotal: number;
  discount: number;
  total: number;
}

interface PaymentResult {
  transactionId: string;
  status: string;
}

class OrderService_GOOD {
  constructor(
    private readonly inventoryService: IInventoryService,
    private readonly pricingService: IPricingService,
    private readonly paymentService: IPaymentService,
    private readonly notificationService: INotificationService,
    // private readonly orderRepository: IOrderRepository,
  ) {}

  async createOrder(userId: string, input: CreateOrderInput): Promise<OrderResult> {
    await this.inventoryService.validateStock(input.items);

    const pricing = await this.pricingService.calculateTotal(
      input.items,
      input.couponCode,
    );

    const payment = await this.paymentService.processPayment(
      pricing.total,
      input.paymentMethod,
    );

    const order = await this.saveOrder(userId, input, pricing, payment);

    // Fire-and-forget (không block response)
    this.notificationService
      .sendOrderConfirmation(order.id, input.email)
      .catch((err) => console.error('Notification failed:', err));

    return order;
  }

  private async saveOrder(
    userId: string,
    input: CreateOrderInput,
    pricing: PricingResult,
    payment: PaymentResult,
  ): Promise<OrderResult> {
    return {
      id: 'order-123',
      userId,
      items: input.items,
      total: pricing.total,
      transactionId: payment.transactionId,
      status: 'CONFIRMED',
    };
  }
}

// ═══════════════════════════════════════════
// Rule 3.2: Transaction Handling
// ═══════════════════════════════════════════

// ❌ BAD: Không có transaction, data inconsistent khi fail
class TransferService_BAD {
  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    await this.deductBalance(fromId, amount);    // ✓ Trừ xong
    await this.addBalance(toId, amount);          // ✗ Fail → tiền bị mất!
    await this.createTransferLog(fromId, toId, amount);
  }

  private async deductBalance(_id: string, _amount: number): Promise<void> {}
  private async addBalance(_id: string, _amount: number): Promise<void> {
    throw new Error('DB connection lost');
  }
  private async createTransferLog(..._args: unknown[]): Promise<void> {}
}

// ✅ GOOD: Dùng transaction, rollback khi fail
/*
class TransferService {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .update(Account)
        .set({ balance: () => `balance - ${amount}` })
        .where('id = :id AND balance >= :amount', { id: fromId, amount })
        .execute();

      await queryRunner.manager
        .createQueryBuilder()
        .update(Account)
        .set({ balance: () => `balance + ${amount}` })
        .where('id = :id', { id: toId })
        .execute();

      await queryRunner.manager.save(TransferLog, {
        fromAccountId: fromId,
        toAccountId: toId,
        amount,
        createdAt: new Date(),
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
*/

// ═══════════════════════════════════════════
// Rule 3.3: Service Method — Small & Focused
// ═══════════════════════════════════════════

// ❌ BAD: Method quá dài, làm nhiều việc
class UserService_BAD {
  async registerUser(data: any): Promise<any> {
    // Check email exists → validate password strength →
    // hash password → create user → assign default role →
    // create profile → send welcome email → log event →
    // ... 80+ lines
    return data;
  }
}

// ✅ GOOD: Tách thành các private methods nhỏ
class UserService_GOOD {
  async registerUser(input: RegisterInput): Promise<UserResult> {
    await this.ensureEmailNotTaken(input.email);
    const hashedPassword = await this.hashPassword(input.password);
    const user = await this.createUserWithProfile(input, hashedPassword);
    await this.assignDefaultRole(user.id);
    this.sendWelcomeEmailAsync(user);
    return user;
  }

  private async ensureEmailNotTaken(email: string): Promise<void> {
    const exists = email.includes('@'); // Simulate check
    if (exists) {
      // throw new ConflictException(`Email ${email} already registered`);
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // return bcrypt.hash(password, 12);
    return `hashed_${password}`;
  }

  private async createUserWithProfile(
    input: RegisterInput,
    hashedPassword: string,
  ): Promise<UserResult> {
    return {
      id: 'user-123',
      email: input.email,
      password: hashedPassword,
    };
  }

  private async assignDefaultRole(userId: string): Promise<void> {
    console.log(`Assigning default role to ${userId}`);
  }

  private sendWelcomeEmailAsync(user: UserResult): void {
    // Fire-and-forget, log error but don't fail registration
    Promise.resolve()
      .then(() => console.log(`Welcome email sent to ${user.email}`))
      .catch((err) => console.error('Welcome email failed:', err));
  }
}

// ═══════════════════════════════════════════
// Rule 3.4: Interface-Based DI
// ═══════════════════════════════════════════

// ❌ BAD: Depend on concrete class
/*
class OrderService {
  constructor(
    private readonly stripeService: StripePaymentService, // Concrete!
  ) {}
}
*/

// ✅ GOOD: Depend on interface (abstraction)
/*
// payment.interface.ts
export interface IPaymentGateway {
  charge(amount: number, currency: string): Promise<ChargeResult>;
  refund(transactionId: string): Promise<RefundResult>;
}

// stripe-payment.service.ts
@Injectable()
export class StripePaymentService implements IPaymentGateway {
  async charge(amount: number, currency: string): Promise<ChargeResult> { ... }
  async refund(transactionId: string): Promise<RefundResult> { ... }
}

// order.module.ts
@Module({
  providers: [
    { provide: 'PAYMENT_GATEWAY', useClass: StripePaymentService },
    OrderService,
  ],
})

// order.service.ts
@Injectable()
export class OrderService {
  constructor(
    @Inject('PAYMENT_GATEWAY') private readonly paymentGateway: IPaymentGateway,
  ) {}
}
// → Dễ swap sang PayPal, VNPay mà KHÔNG đổi OrderService
*/

// ═══════════════════════════════════════════
// Types cho ví dụ trên
// ═══════════════════════════════════════════

interface CreateOrderInput {
  items: OrderItemInput[];
  couponCode?: string;
  paymentMethod: string;
  email: string;
}

interface OrderResult {
  id: string;
  userId: string;
  items: OrderItemInput[];
  total: number;
  transactionId: string;
  status: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface UserResult {
  id: string;
  email: string;
  password: string;
}

export {
  OrderService_GOOD,
  UserService_GOOD,
  type IInventoryService,
  type IPricingService,
  type IPaymentService,
  type INotificationService,
};
