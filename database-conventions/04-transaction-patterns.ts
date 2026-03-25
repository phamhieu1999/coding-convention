/**
 * ============================================
 * DATABASE CONVENTION #4: TRANSACTION PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng transaction cho operations cần atomic
 * 2. Chọn isolation level phù hợp
 * 3. Giữ transaction ngắn nhất có thể
 * 4. Saga pattern cho distributed transactions
 * 5. Idempotency — xử lý retry an toàn
 * 6. Optimistic locking cho concurrent updates
 */

// ═══════════════════════════════════════════
// Rule 4.1: Khi nào cần Transaction
// ═══════════════════════════════════════════

// ❌ BAD: Không dùng transaction cho multi-step operations
/*
async transfer(fromId: string, toId: string, amount: number): Promise<void> {
  await this.accountRepo.deduct(fromId, amount);  // ✓ Success
  await this.accountRepo.add(toId, amount);         // ✗ FAIL → tiền mất!
  await this.logRepo.createTransferLog(fromId, toId, amount);
}
*/

// ✅ GOOD: Transaction bao bọc atomic operations
/*
async transfer(fromId: string, toId: string, amount: number): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Tất cả operations trong 1 transaction
    const fromAccount = await queryRunner.manager.findOne(Account, {
      where: { id: fromId },
      lock: { mode: 'pessimistic_write' }, // Lock row để tránh race condition
    });

    if (!fromAccount || fromAccount.balance < amount) {
      throw new BusinessRuleViolationException('Insufficient balance');
    }

    await queryRunner.manager.update(Account, fromId, {
      balance: () => `balance - ${amount}`,
    });

    await queryRunner.manager.update(Account, toId, {
      balance: () => `balance + ${amount}`,
    });

    await queryRunner.manager.save(TransferLog, {
      fromAccountId: fromId,
      toAccountId: toId,
      amount,
      status: 'completed',
    });

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction(); // Rollback tất cả nếu fail
    throw error;
  } finally {
    await queryRunner.release(); // LUÔN release connection
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4.2: Isolation Levels
// ═══════════════════════════════════════════

const ISOLATION_LEVELS = {
  'READ UNCOMMITTED': {
    description: 'Đọc data chưa commit (dirty read)',
    useCase: 'Hầu như KHÔNG bao giờ dùng',
    problems: ['Dirty read', 'Non-repeatable read', 'Phantom read'],
  },
  'READ COMMITTED': {
    description: 'Chỉ đọc data đã commit (PostgreSQL default)',
    useCase: 'Default cho hầu hết operations',
    problems: ['Non-repeatable read', 'Phantom read'],
  },
  'REPEATABLE READ': {
    description: 'Data đọc trong transaction không đổi',
    useCase: 'Reports, tính toán cần consistency',
    problems: ['Phantom read (theo SQL standard, nhưng PostgreSQL tránh được)'],
  },
  'SERIALIZABLE': {
    description: 'Transactions thực thi như tuần tự',
    useCase: 'Financial transactions, inventory deduction',
    problems: ['Performance thấp nhất, có thể serialization failure → cần retry'],
  },
};

/*
// Sử dụng:
await queryRunner.startTransaction('SERIALIZABLE'); // Cho financial ops
await queryRunner.startTransaction('READ COMMITTED'); // Default
await queryRunner.startTransaction('REPEATABLE READ'); // Reports
*/

// ═══════════════════════════════════════════
// Rule 4.3: Optimistic Locking
// ═══════════════════════════════════════════

// ❌ BAD: Race condition khi concurrent update
/*
// User A reads product (stock = 10)
// User B reads product (stock = 10)
// User A updates: stock = 10 - 1 = 9
// User B updates: stock = 10 - 1 = 9 ← WRONG! Should be 8
*/

// ✅ GOOD: Version-based optimistic locking
/*
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  stock: number;

  @VersionColumn() // TypeORM auto-increments on update
  version: number;
}

// Service:
async purchaseProduct(productId: string, quantity: number): Promise<void> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const product = await this.productRepo.findOneBy({ id: productId });
      if (!product) throw new NotFoundException('Product not found');
      if (product.stock < quantity) throw new BusinessRuleViolationException('Insufficient stock');

      product.stock -= quantity;
      await this.productRepo.save(product);
      // TypeORM checks: WHERE id = ? AND version = ?
      // If version changed → OptimisticLockVersionMismatchError
      return;
    } catch (error) {
      if (error.name === 'OptimisticLockVersionMismatchError') {
        attempt++;
        if (attempt >= maxRetries) {
          throw new ConflictException('Concurrent update conflict. Please retry.');
        }
        await new Promise(r => setTimeout(r, 100 * attempt)); // Backoff
        continue;
      }
      throw error;
    }
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4.4: Saga Pattern (Distributed Transactions)
// ═══════════════════════════════════════════

// Khi operation span nhiều services/databases → không dùng DB transaction được
// → Saga: chuỗi local transactions + compensating transactions

interface SagaStep<T> {
  name: string;
  execute: (context: T) => Promise<T>;
  compensate: (context: T) => Promise<T>;
}

class SagaOrchestrator<T> {
  private completedSteps: SagaStep<T>[] = [];

  constructor(private readonly steps: SagaStep<T>[]) {}

  async execute(initialContext: T): Promise<T> {
    let context = initialContext;

    for (const step of this.steps) {
      try {
        context = await step.execute(context);
        this.completedSteps.push(step);
      } catch (error) {
        console.error(`Saga step "${step.name}" failed:`, error);
        await this.compensate(context);
        throw error;
      }
    }

    return context;
  }

  private async compensate(context: T): Promise<void> {
    // Compensate in reverse order
    for (const step of [...this.completedSteps].reverse()) {
      try {
        await step.compensate(context);
        console.log(`Compensated: ${step.name}`);
      } catch (compensateError) {
        console.error(`Compensation failed for "${step.name}":`, compensateError);
        // Log for manual intervention
      }
    }
  }
}

// Ví dụ: Create Order Saga
interface OrderSagaContext {
  orderId: string;
  userId: string;
  items: { productId: string; quantity: number }[];
  paymentId?: string;
  totalAmount: number;
}

const createOrderSaga: SagaStep<OrderSagaContext>[] = [
  {
    name: 'Reserve Inventory',
    execute: async (ctx) => {
      console.log(`Reserving inventory for order ${ctx.orderId}`);
      return ctx;
    },
    compensate: async (ctx) => {
      console.log(`Releasing inventory for order ${ctx.orderId}`);
      return ctx;
    },
  },
  {
    name: 'Process Payment',
    execute: async (ctx) => {
      console.log(`Charging ${ctx.totalAmount} for order ${ctx.orderId}`);
      ctx.paymentId = `pay_${Date.now()}`;
      return ctx;
    },
    compensate: async (ctx) => {
      if (ctx.paymentId) {
        console.log(`Refunding payment ${ctx.paymentId}`);
      }
      return ctx;
    },
  },
  {
    name: 'Create Order Record',
    execute: async (ctx) => {
      console.log(`Creating order record ${ctx.orderId}`);
      return ctx;
    },
    compensate: async (ctx) => {
      console.log(`Cancelling order ${ctx.orderId}`);
      return ctx;
    },
  },
  {
    name: 'Send Confirmation',
    execute: async (ctx) => {
      console.log(`Sending confirmation for order ${ctx.orderId}`);
      return ctx;
    },
    compensate: async (_ctx) => {
      // Email đã gửi → không compensate được, gửi email hủy thay thế
      return _ctx;
    },
  },
];

// ═══════════════════════════════════════════
// Rule 4.5: Idempotency
// ═══════════════════════════════════════════

// ❌ BAD: Retry tạo ra duplicate
/*
async createPayment(orderId: string, amount: number): Promise<Payment> {
  // Network timeout → client retry → tạo 2 payments!
  return this.paymentRepo.save({ orderId, amount, status: 'completed' });
}
*/

// ✅ GOOD: Idempotency key ngăn duplicate
/*
async createPayment(
  orderId: string,
  amount: number,
  idempotencyKey: string, // Client gửi kèm, unique per operation
): Promise<Payment> {
  // Check if already processed
  const existing = await this.paymentRepo.findOne({
    where: { idempotencyKey },
  });
  if (existing) return existing; // Return cached result

  try {
    // Unique constraint trên idempotency_key → DB-level protection
    return await this.paymentRepo.save({
      orderId,
      amount,
      idempotencyKey,
      status: 'completed',
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Race condition: concurrent request with same key
      return this.paymentRepo.findOneBy({ idempotencyKey });
    }
    throw error;
  }
}
*/

export {
  SagaOrchestrator,
  createOrderSaga,
  ISOLATION_LEVELS,
  type SagaStep,
  type OrderSagaContext,
};
