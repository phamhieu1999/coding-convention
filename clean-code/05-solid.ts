/**
 * ============================================
 * CLEAN CODE RULE #5: SOLID PRINCIPLES
 * ============================================
 *
 * S - Single Responsibility Principle (SRP)
 * O - Open/Closed Principle (OCP)
 * L - Liskov Substitution Principle (LSP)
 * I - Interface Segregation Principle (ISP)
 * D - Dependency Inversion Principle (DIP)
 */

// ═══════════════════════════════════════════
// S: Single Responsibility Principle
// Mỗi class chỉ có MỘT lý do để thay đổi
// ═══════════════════════════════════════════

// ❌ BAD: Class làm quá nhiều việc
class UserService_BAD {
  createUser(name: string, email: string) {
    // validate
    if (!email.includes('@')) throw new Error('Bad email');
    // save to DB
    console.log(`INSERT INTO users (${name}, ${email})`);
    // send welcome email
    console.log(`Sending welcome email to ${email}`);
    // generate report
    console.log(`Generating user report for ${name}`);
  }
}

// ✅ GOOD: Mỗi class một trách nhiệm
class UserValidator {
  validate(email: string): void {
    if (!email.includes('@')) throw new Error('Invalid email format');
  }
}

class UserRepository {
  async save(user: { name: string; email: string }): Promise<string> {
    console.log(`Persisting user: ${user.name}`);
    return 'user-id-123';
  }
}

class EmailService {
  async sendWelcome(email: string, name: string): Promise<void> {
    console.log(`Welcome email → ${email}`);
  }
}

class UserService {
  constructor(
    private readonly validator: UserValidator,
    private readonly repository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async createUser(name: string, email: string): Promise<string> {
    this.validator.validate(email);
    const userId = await this.repository.save({ name, email });
    await this.emailService.sendWelcome(email, name);
    return userId;
  }
}

// ═══════════════════════════════════════════
// O: Open/Closed Principle
// Open for extension, closed for modification
// ═══════════════════════════════════════════

// ❌ BAD: Phải sửa code cũ mỗi khi thêm loại discount mới
function calculateDiscount_BAD(type: string, amount: number): number {
  if (type === 'percentage') return amount * 0.1;
  if (type === 'fixed') return 50;
  if (type === 'seasonal') return amount * 0.2;
  // Thêm loại mới → phải sửa hàm này
  return 0;
}

// ✅ GOOD: Mở rộng bằng cách thêm class mới, không sửa code cũ
interface DiscountStrategy {
  calculate(amount: number): number;
}

class PercentageDiscount implements DiscountStrategy {
  constructor(private readonly percent: number) {}
  calculate(amount: number): number {
    return amount * (this.percent / 100);
  }
}

class FixedDiscount implements DiscountStrategy {
  constructor(private readonly fixedAmount: number) {}
  calculate(amount: number): number {
    return Math.min(this.fixedAmount, amount);
  }
}

class BuyOneGetOneDiscount implements DiscountStrategy {
  calculate(amount: number): number {
    return amount * 0.5;
  }
}

// Thêm loại discount mới → chỉ cần tạo class mới
class TieredDiscount implements DiscountStrategy {
  calculate(amount: number): number {
    if (amount > 1000) return amount * 0.2;
    if (amount > 500) return amount * 0.1;
    return amount * 0.05;
  }
}

class PriceCalculator {
  applyDiscount(amount: number, strategy: DiscountStrategy): number {
    return amount - strategy.calculate(amount);
  }
}

// ═══════════════════════════════════════════
// I: Interface Segregation Principle
// Client không nên phụ thuộc interface mà nó không dùng
// ═══════════════════════════════════════════

// ❌ BAD: Interface quá lớn, ép client implement method không cần
interface Animal_BAD {
  eat(): void;
  swim(): void;
  fly(): void;
  run(): void;
}

// Con mèo thì không fly, nhưng vẫn phải implement
class Cat_BAD implements Animal_BAD {
  eat() { console.log('Eating'); }
  swim() { throw new Error('Cats hate water!'); } // không hợp lý
  fly() { throw new Error('Cats cannot fly!'); }   // không hợp lý
  run() { console.log('Running'); }
}

// ✅ GOOD: Tách thành nhiều interface nhỏ
interface Eatable {
  eat(): void;
}

interface Swimmable {
  swim(): void;
}

interface Flyable {
  fly(): void;
}

interface Runnable {
  run(): void;
}

class Cat implements Eatable, Runnable {
  eat() { console.log('Cat eating fish'); }
  run() { console.log('Cat running fast'); }
}

class Duck implements Eatable, Swimmable, Flyable {
  eat() { console.log('Duck eating'); }
  swim() { console.log('Duck swimming'); }
  fly() { console.log('Duck flying'); }
}

// ═══════════════════════════════════════════
// D: Dependency Inversion Principle
// Depend on abstractions, not concretions
// ═══════════════════════════════════════════

// ❌ BAD: High-level module phụ thuộc trực tiếp low-level
class MySQLDatabase {
  query(sql: string): unknown[] { return []; }
}

class OrderService_BAD {
  private db = new MySQLDatabase(); // tight coupling!

  getOrders() {
    return this.db.query('SELECT * FROM orders');
  }
}
// Nếu đổi sang MongoDB → phải sửa OrderService

// ✅ GOOD: Phụ thuộc abstraction (interface)
interface DatabasePort {
  findAll<T>(table: string): Promise<T[]>;
  findById<T>(table: string, id: string): Promise<T | null>;
  insert<T>(table: string, data: T): Promise<string>;
}

// Adapter cho MySQL
class MySQLAdapter implements DatabasePort {
  async findAll<T>(table: string): Promise<T[]> {
    console.log(`MySQL: SELECT * FROM ${table}`);
    return [];
  }
  async findById<T>(table: string, id: string): Promise<T | null> {
    console.log(`MySQL: SELECT * FROM ${table} WHERE id = ${id}`);
    return null;
  }
  async insert<T>(table: string, data: T): Promise<string> {
    console.log(`MySQL: INSERT INTO ${table}`);
    return 'new-id';
  }
}

// Adapter cho MongoDB
class MongoAdapter implements DatabasePort {
  async findAll<T>(table: string): Promise<T[]> {
    console.log(`Mongo: db.${table}.find({})`);
    return [];
  }
  async findById<T>(table: string, id: string): Promise<T | null> {
    console.log(`Mongo: db.${table}.findOne({_id: ${id}})`);
    return null;
  }
  async insert<T>(table: string, data: T): Promise<string> {
    console.log(`Mongo: db.${table}.insertOne()`);
    return 'new-id';
  }
}

// High-level module chỉ phụ thuộc interface
class OrderService {
  constructor(private readonly database: DatabasePort) {}

  async getOrders() {
    return this.database.findAll('orders');
  }

  async getOrderById(id: string) {
    return this.database.findById('orders', id);
  }
}

// Dễ dàng swap implementation:
const orderServiceMySQL = new OrderService(new MySQLAdapter());
const orderServiceMongo = new OrderService(new MongoAdapter());

export {
  UserService,
  PriceCalculator,
  PercentageDiscount,
  FixedDiscount,
  TieredDiscount,
  OrderService,
  type DatabasePort,
};
