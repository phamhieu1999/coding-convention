/**
 * ============================================
 * CLEAN CODE RULE #1: NAMING (Đặt tên có ý nghĩa)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Tên biến/hàm phải tự giải thích (self-documenting)
 * 2. Dùng động từ cho hàm, danh từ cho biến
 * 3. Tránh viết tắt mơ hồ
 * 4. Tên phải phản ánh đúng ngữ cảnh business
 * 5. Dùng tên có thể phát âm và tìm kiếm được
 */

// ❌ BAD: Tên mơ hồ, không rõ ý nghĩa
function calc(d: number[]): number {
  let t = 0;
  for (const i of d) {
    if (i > 0) t += i;
  }
  return t;
}

const d = 86400000; // magic number, không biết là gì
const u = { n: 'John', a: 25, e: 'john@mail.com' };

// ✅ GOOD: Tên rõ ràng, tự giải thích
function calculateTotalRevenue(dailySales: number[]): number {
  let totalRevenue = 0;
  for (const sale of dailySales) {
    if (sale > 0) totalRevenue += sale;
  }
  return totalRevenue;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const customer = { name: 'John', age: 25, email: 'john@mail.com' };

// ─────────────────────────────────────────────
// Ví dụ thực tế: E-Commerce Order System
// ─────────────────────────────────────────────

// ❌ BAD
interface Obj {
  id: string;
  s: number;   // status?
  p: number;   // price?
  q: number;   // quantity?
  dt: string;  // date?
}

function proc(o: Obj): boolean {
  if (o.s === 1 && o.p * o.q > 0) {
    return true;
  }
  return false;
}

// ✅ GOOD
enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface Order {
  orderId: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  customerId: string;
}

function isOrderEligibleForShipment(order: Order): boolean {
  const hasConfirmedStatus = order.status === OrderStatus.CONFIRMED;
  const hasPaidItems = order.items.some(
    (item) => item.unitPrice * item.quantity > 0,
  );
  return hasConfirmedStatus && hasPaidItems;
}

// ─────────────────────────────────────────────
// Boolean: dùng tiền tố is/has/can/should
// ─────────────────────────────────────────────

// ❌ BAD
const active = true;
const permission = false;
function check(user: any): boolean { return true; }

// ✅ GOOD
const isActive = true;
const hasPermission = false;
function canUserAccessResource(user: { role: string }): boolean {
  return user.role === 'admin' || user.role === 'manager';
}

// ─────────────────────────────────────────────
// Constants: UPPER_SNAKE_CASE cho hằng số
// ─────────────────────────────────────────────

// ❌ BAD
const maxRetry = 3;
const apiurl = 'https://api.example.com';
const taxrate = 0.1;

// ✅ GOOD
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';
const TAX_RATE_PERCENTAGE = 0.1;
const PASSWORD_MIN_LENGTH = 8;
const JWT_EXPIRATION_HOURS = 24;

export {
  calculateTotalRevenue,
  isOrderEligibleForShipment,
  canUserAccessResource,
  OrderStatus,
};
