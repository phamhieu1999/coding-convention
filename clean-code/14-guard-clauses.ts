/**
 * ============================================
 * CLEAN CODE RULE #14: GUARD CLAUSES & EARLY RETURN
 * ============================================
 *
 * Nguyên tắc:
 * 1. Return sớm khi điều kiện không hợp lệ
 * 2. Giảm nesting, giảm cognitive complexity
 * 3. Validate input ở đầu hàm (fail fast)
 * 4. Happy path nằm ở cuối hàm, không bị indent sâu
 */

// ═══════════════════════════════════════════
// Rule 14.1: Early Return thay vì nested if/else
// ═══════════════════════════════════════════

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: 'admin' | 'user' | 'moderator';
  subscription?: { plan: string; expiresAt: Date };
}

// ❌ BAD: Arrow code / pyramid of doom
function canAccessPremium_BAD(user: User | null): boolean {
  if (user !== null) {
    if (user.isActive) {
      if (user.subscription) {
        if (user.subscription.expiresAt > new Date()) {
          if (user.subscription.plan === 'premium') {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ✅ GOOD: Guard clauses — flat, dễ đọc
function canAccessPremium(user: User | null): boolean {
  if (!user) return false;
  if (!user.isActive) return false;
  if (!user.subscription) return false;
  if (user.subscription.expiresAt <= new Date()) return false;

  return user.subscription.plan === 'premium';
}

// ═══════════════════════════════════════════
// Rule 14.2: Validate đầu hàm (Fail Fast)
// ═══════════════════════════════════════════

// ❌ BAD: Validate trộn lẫn business logic
async function createUser_BAD(
  name: string,
  email: string,
  age: number,
): Promise<{ success: boolean; error?: string }> {
  if (name) {
    if (email.includes('@')) {
      if (age >= 18) {
        // Business logic bị indent sâu 3 cấp
        const user = { name, email, age };
        // await db.save(user);
        return { success: true };
      } else {
        return { success: false, error: 'Must be 18+' };
      }
    } else {
      return { success: false, error: 'Invalid email' };
    }
  } else {
    return { success: false, error: 'Name required' };
  }
}

// ✅ GOOD: Guard clauses → validate xong mới chạy logic
async function createUser(
  name: string,
  email: string,
  age: number,
): Promise<{ id: string }> {
  if (!name.trim()) throw new Error('Name is required');
  if (!email.includes('@')) throw new Error('Invalid email format');
  if (age < 18) throw new Error('Must be at least 18 years old');
  if (age > 150) throw new Error('Invalid age');

  // Happy path — clean, không indent sâu
  const user = { id: crypto.randomUUID(), name: name.trim(), email, age };
  // await db.save(user);
  return { id: user.id };
}

// ═══════════════════════════════════════════
// Rule 14.3: Guard trong loop — continue/break
// ═══════════════════════════════════════════

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'shipped' | 'cancelled';
  total: number;
  items: { productId: string; quantity: number }[];
}

// ❌ BAD: Nested if trong loop
function calculateRevenue_BAD(orders: Order[]): number {
  let revenue = 0;
  for (const order of orders) {
    if (order.status !== 'cancelled') {
      if (order.total > 0) {
        if (order.items.length > 0) {
          revenue += order.total;
        }
      }
    }
  }
  return revenue;
}

// ✅ GOOD: continue để skip invalid items → flat loop body
function calculateRevenue(orders: readonly Order[]): number {
  let revenue = 0;

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    if (order.total <= 0) continue;
    if (order.items.length === 0) continue;

    revenue += order.total;
  }

  return revenue;
}

// ═══════════════════════════════════════════
// Rule 14.4: Assertion functions (TypeScript)
// ═══════════════════════════════════════════

// Guard function kết hợp TypeScript type narrowing
function assertDefined<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} must be defined`);
  }
}

function assertPositive(value: number, name: string): void {
  if (value <= 0) throw new Error(`${name} must be positive`);
}

// Sử dụng: Code sau assert được TypeScript narrow type tự động
async function processOrder(orderId: string | null, quantity: number): Promise<void> {
  assertDefined(orderId, 'orderId');
  assertPositive(quantity, 'quantity');

  // Sau assertDefined → orderId chắc chắn là string (không phải null)
  // Sau assertPositive → quantity chắc chắn > 0
  console.log(`Processing order ${orderId} with ${quantity} items`);
}

// ═══════════════════════════════════════════
// Rule 14.5: Object/Map thay vì if/else chain dài
// ═══════════════════════════════════════════

// ❌ BAD: Chuỗi if/else dài → khó maintain, dễ quên case
function getDiscount_BAD(plan: string): number {
  if (plan === 'basic') {
    return 0;
  } else if (plan === 'standard') {
    return 10;
  } else if (plan === 'premium') {
    return 20;
  } else if (plan === 'enterprise') {
    return 30;
  } else {
    return 0;
  }
}

// ✅ GOOD: Lookup map — O(1), dễ thêm/sửa/xóa
const PLAN_DISCOUNTS: Record<string, number> = {
  basic: 0,
  standard: 10,
  premium: 20,
  enterprise: 30,
} as const;

function getDiscount(plan: string): number {
  return PLAN_DISCOUNTS[plan] ?? 0;
}

export {
  canAccessPremium,
  createUser,
  calculateRevenue,
  assertDefined,
  assertPositive,
  getDiscount,
};
