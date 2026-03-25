/**
 * ============================================
 * CLEAN CODE RULE #13: DEPENDENCY INJECTION & LOOSE COUPLING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Code to interfaces, không implementation cụ thể
 * 2. Constructor injection thay vì hard-coded dependencies
 * 3. Dễ test (mock/stub), dễ swap implementation
 * 4. Inversion of Control — caller quyết định dependency
 */

// ═══════════════════════════════════════════
// Rule 13.1: Constructor Injection thay vì hard-coded
// ═══════════════════════════════════════════

// ❌ BAD: Hard-coded dependency → không thể test, không thể thay thế
class OrderService_BAD {
  private db = new MySQLDatabase();     // Tight coupling!
  private mailer = new SmtpMailer();    // Hard-coded!
  private logger = new FileLogger();    // Không swap được!

  async createOrder(data: any): Promise<void> {
    await this.db.save(data);
    await this.mailer.send('order@shop.com', 'New order', 'Order details');
    this.logger.info('Order created');
  }
}

// ✅ GOOD: Nhận dependency qua constructor → loose coupling
interface IDatabase {
  save(data: unknown): Promise<void>;
  findById(id: string): Promise<unknown>;
}

interface IMailer {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface ILogger {
  info(message: string): void;
  error(message: string, error?: Error): void;
}

class OrderService {
  constructor(
    private readonly db: IDatabase,
    private readonly mailer: IMailer,
    private readonly logger: ILogger,
  ) {}

  async createOrder(data: { email: string; items: string[] }): Promise<void> {
    try {
      await this.db.save(data);
      await this.mailer.send(data.email, 'Order Confirmed', 'Your order has been placed');
      this.logger.info(`Order created for ${data.email}`);
    } catch (error) {
      this.logger.error('Failed to create order', error as Error);
      throw error;
    }
  }
}

// ═══════════════════════════════════════════
// Rule 13.2: Dễ test nhờ DI — mock/stub dependency
// ═══════════════════════════════════════════

// Mock implementations cho testing
class MockDatabase implements IDatabase {
  readonly savedItems: unknown[] = [];

  async save(data: unknown): Promise<void> {
    this.savedItems.push(data);
  }

  async findById(_id: string): Promise<unknown> {
    return this.savedItems[0];
  }
}

class MockMailer implements IMailer {
  readonly sentEmails: { to: string; subject: string; body: string }[] = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sentEmails.push({ to, subject, body });
  }
}

class MockLogger implements ILogger {
  readonly logs: string[] = [];
  readonly errors: string[] = [];

  info(message: string): void { this.logs.push(message); }
  error(message: string): void { this.errors.push(message); }
}

// Test dễ dàng:
async function testOrderCreation(): Promise<void> {
  const db = new MockDatabase();
  const mailer = new MockMailer();
  const logger = new MockLogger();

  const service = new OrderService(db, mailer, logger);
  await service.createOrder({ email: 'test@mail.com', items: ['item1'] });

  console.assert(db.savedItems.length === 1, 'Should save order');
  console.assert(mailer.sentEmails.length === 1, 'Should send email');
  console.assert(logger.logs.length === 1, 'Should log');
}

// ═══════════════════════════════════════════
// Rule 13.3: Strategy Pattern qua DI
// ═══════════════════════════════════════════

// Interface cho payment strategy
interface IPaymentGateway {
  charge(amount: number, currency: string): Promise<{ transactionId: string }>;
  refund(transactionId: string): Promise<void>;
}

// Nhiều implementation → swap dễ dàng
class StripeGateway implements IPaymentGateway {
  async charge(amount: number, currency: string) {
    // Stripe API call
    return { transactionId: `stripe_${Date.now()}` };
  }

  async refund(transactionId: string) {
    // Stripe refund
  }
}

class PayPalGateway implements IPaymentGateway {
  async charge(amount: number, currency: string) {
    // PayPal API call
    return { transactionId: `paypal_${Date.now()}` };
  }

  async refund(transactionId: string) {
    // PayPal refund
  }
}

// Service không biết gateway cụ thể → dễ thêm MoMo, VNPay...
class PaymentService {
  constructor(private readonly gateway: IPaymentGateway) {}

  async processPayment(amount: number, currency: string): Promise<string> {
    const result = await this.gateway.charge(amount, currency);
    return result.transactionId;
  }
}

// ═══════════════════════════════════════════
// Rule 13.4: Factory function cho composition root
// ═══════════════════════════════════════════

// ❌ BAD: Tạo dependency khắp nơi → spaghetti
function handleRequest_BAD() {
  const db = new MySQLDatabase();
  const mailer = new SmtpMailer();
  const logger = new FileLogger();
  const service = new OrderService(db, mailer, logger);
  // ...
}

// ✅ GOOD: Composition root — 1 nơi duy nhất wire dependencies
function createOrderService(env: 'production' | 'test'): OrderService {
  if (env === 'test') {
    return new OrderService(new MockDatabase(), new MockMailer(), new MockLogger());
  }
  return new OrderService(
    new MySQLDatabase(),
    new SmtpMailer(),
    new ConsoleLogger(),
  );
}

// ═══════════════════════════════════════════
// Helper classes giả lập
// ═══════════════════════════════════════════

class MySQLDatabase implements IDatabase {
  async save(_data: unknown) { /* MySQL save */ }
  async findById(_id: string) { return null; }
}

class SmtpMailer implements IMailer {
  async send(_to: string, _subject: string, _body: string) { /* SMTP send */ }
}

class FileLogger implements ILogger {
  info(msg: string) { console.log(`[INFO] ${msg}`); }
  error(msg: string, err?: Error) { console.error(`[ERROR] ${msg}`, err); }
}

class ConsoleLogger implements ILogger {
  info(msg: string) { console.log(`[INFO] ${msg}`); }
  error(msg: string, err?: Error) { console.error(`[ERROR] ${msg}`, err); }
}

export {
  type IDatabase,
  type IMailer,
  type ILogger,
  type IPaymentGateway,
  OrderService,
  PaymentService,
  createOrderService,
};
