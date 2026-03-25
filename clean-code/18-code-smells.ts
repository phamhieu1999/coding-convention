/**
 * ============================================
 * CLEAN CODE RULE #18: CODE SMELLS & REFACTORING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Nhận diện code smells: God class, Long method, Feature envy
 * 2. Primitive obsession → Value Objects
 * 3. Replace conditional with polymorphism
 * 4. Extract method, Extract class
 * 5. Tell, don't ask
 */

// ═══════════════════════════════════════════
// Smell #1: Primitive Obsession → Value Objects
// ═══════════════════════════════════════════

// ❌ BAD: Dùng primitive types cho concepts có logic riêng
function createInvoice_BAD(
  amount: number,    // USD? VND? Không biết!
  currency: string,  // "USD"? "usd"? "U.S. Dollar"?
  email: string,     // Có validate không?
) {
  if (amount < 0) throw new Error('Invalid amount');
  if (!email.includes('@')) throw new Error('Invalid email');
  // Validate logic lặp lại ở mọi nơi dùng amount, email
}

// ✅ GOOD: Value Objects — đóng gói logic + validation
class Money {
  private constructor(
    readonly amount: number,
    readonly currency: 'USD' | 'VND' | 'EUR',
  ) {}

  static create(amount: number, currency: 'USD' | 'VND' | 'EUR'): Money {
    if (amount < 0) throw new Error('Amount cannot be negative');
    if (!Number.isFinite(amount)) throw new Error('Amount must be finite');
    return new Money(Math.round(amount * 100) / 100, currency);
  }

  add(other: Money): Money {
    this.#assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.#assertSameCurrency(other);
    return Money.create(this.amount - other.amount, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.#assertSameCurrency(other);
    return this.amount > other.amount;
  }

  format(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount);
  }

  #assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate on different currencies: ${this.currency} vs ${other.currency}`);
    }
  }
}

class Email {
  readonly value: string;

  constructor(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error(`Invalid email: ${value}`);
    }
    this.value = trimmed;
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

// ═══════════════════════════════════════════
// Smell #2: Long Method → Extract Method
// ═══════════════════════════════════════════

interface OrderData {
  items: { price: number; quantity: number }[];
  customerType: 'regular' | 'vip' | 'employee';
  couponCode?: string;
}

// ❌ BAD: Method quá dài, làm nhiều việc
function processOrder_BAD(order: OrderData): number {
  // Tính subtotal
  let subtotal = 0;
  for (const item of order.items) {
    subtotal += item.price * item.quantity;
  }

  // Tính discount
  let discount = 0;
  if (order.customerType === 'vip') {
    discount = subtotal * 0.15;
  } else if (order.customerType === 'employee') {
    discount = subtotal * 0.30;
  }

  // Áp dụng coupon
  if (order.couponCode === 'SAVE10') {
    discount += subtotal * 0.10;
  } else if (order.couponCode === 'SAVE20') {
    discount += subtotal * 0.20;
  }

  // Tính tax
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * 0.08;

  // Tính shipping
  let shipping = 0;
  if (afterDiscount < 100) {
    shipping = 10;
  } else if (afterDiscount < 500) {
    shipping = 5;
  }
  // Free shipping nếu >= 500

  return afterDiscount + tax + shipping;
}

// ✅ GOOD: Extract method — mỗi method 1 việc, có tên rõ ràng
function processOrder(order: OrderData): number {
  const subtotal = calculateSubtotal(order.items);
  const discount = calculateDiscount(subtotal, order.customerType, order.couponCode);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = calculateTax(afterDiscount);
  const shipping = calculateShipping(afterDiscount);

  return afterDiscount + tax + shipping;
}

function calculateSubtotal(items: OrderData['items']): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calculateDiscount(
  subtotal: number,
  customerType: OrderData['customerType'],
  couponCode?: string,
): number {
  const customerDiscount = getCustomerDiscount(customerType);
  const couponDiscount = getCouponDiscount(couponCode);
  return subtotal * (customerDiscount + couponDiscount);
}

const CUSTOMER_DISCOUNTS: Record<OrderData['customerType'], number> = {
  regular: 0,
  vip: 0.15,
  employee: 0.30,
};

function getCustomerDiscount(type: OrderData['customerType']): number {
  return CUSTOMER_DISCOUNTS[type] ?? 0;
}

const COUPON_DISCOUNTS: Record<string, number> = {
  SAVE10: 0.10,
  SAVE20: 0.20,
};

function getCouponDiscount(code?: string): number {
  return code ? (COUPON_DISCOUNTS[code] ?? 0) : 0;
}

function calculateTax(amount: number): number {
  const TAX_RATE = 0.08;
  return amount * TAX_RATE;
}

function calculateShipping(orderTotal: number): number {
  if (orderTotal >= 500) return 0;     // Free shipping
  if (orderTotal >= 100) return 5;
  return 10;
}

// ═══════════════════════════════════════════
// Smell #3: Feature Envy → Tell, Don't Ask
// ═══════════════════════════════════════════

interface Employee {
  baseSalary: number;
  bonus: number;
  deductions: number;
}

// ❌ BAD: Feature envy — function "ghen tị" với data của object khác
function calculateNetPay_BAD(employee: Employee): number {
  // Hàm này biết quá nhiều về cấu trúc Employee
  return employee.baseSalary + employee.bonus - employee.deductions;
}

// ✅ GOOD: Tell, Don't Ask — object tự xử lý logic của mình
class EmployeePayroll {
  constructor(
    private readonly baseSalary: number,
    private readonly bonus: number,
    private readonly deductions: number,
  ) {}

  // Object tự biết cách tính lương → encapsulated
  calculateNetPay(): number {
    return this.baseSalary + this.bonus - this.deductions;
  }

  calculateTax(): number {
    const netPay = this.calculateNetPay();
    return netPay * 0.2; // 20% tax
  }

  generatePaySlip(): string {
    return [
      `Base: ${this.baseSalary}`,
      `Bonus: ${this.bonus}`,
      `Deductions: -${this.deductions}`,
      `Net: ${this.calculateNetPay()}`,
      `Tax: ${this.calculateTax()}`,
    ].join('\n');
  }
}

// ═══════════════════════════════════════════
// Smell #4: Replace Conditional with Polymorphism
// ═══════════════════════════════════════════

// ❌ BAD: Switch/if chain → mỗi lần thêm type phải sửa nhiều chỗ
function calculateArea_BAD(shape: { type: string; width?: number; height?: number; radius?: number }): number {
  switch (shape.type) {
    case 'rectangle':
      return (shape.width ?? 0) * (shape.height ?? 0);
    case 'circle':
      return Math.PI * (shape.radius ?? 0) ** 2;
    case 'triangle':
      return ((shape.width ?? 0) * (shape.height ?? 0)) / 2;
    default:
      throw new Error(`Unknown shape: ${shape.type}`);
  }
}

// ✅ GOOD: Polymorphism → thêm shape mới = thêm class mới, không sửa code cũ
interface Shape {
  area(): number;
  perimeter(): number;
}

class Rectangle implements Shape {
  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  area(): number {
    return this.width * this.height;
  }

  perimeter(): number {
    return 2 * (this.width + this.height);
  }
}

class Circle implements Shape {
  constructor(private readonly radius: number) {}

  area(): number {
    return Math.PI * this.radius ** 2;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}

// Thêm shape mới → chỉ cần thêm class, open/closed principle
class Triangle implements Shape {
  constructor(
    private readonly base: number,
    private readonly height: number,
    private readonly sideA: number,
    private readonly sideB: number,
  ) {}

  area(): number {
    return (this.base * this.height) / 2;
  }

  perimeter(): number {
    return this.base + this.sideA + this.sideB;
  }
}

// Sử dụng: không cần switch, polymorphism tự xử lý
function totalArea(shapes: readonly Shape[]): number {
  return shapes.reduce((sum, shape) => sum + shape.area(), 0);
}

export {
  Money,
  Email,
  processOrder,
  EmployeePayroll,
  type Shape,
  Rectangle,
  Circle,
  Triangle,
  totalArea,
};
