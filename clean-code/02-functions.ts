/**
 * ============================================
 * CLEAN CODE RULE #2: FUNCTIONS (Hàm sạch)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Mỗi hàm chỉ làm MỘT việc (Single Responsibility)
 * 2. Hàm < 30 dòng
 * 3. Tối đa 3 tham số (dùng object nếu nhiều hơn)
 * 4. Không có side effect bất ngờ
 * 5. Tránh flag argument (boolean parameter)
 * 6. Dùng early return để giảm nesting
 * 7. Hàm nên thuần (pure function) khi có thể
 */

// ═══════════════════════════════════════════
// Rule 2.1: Mỗi hàm chỉ làm MỘT việc
// ═══════════════════════════════════════════

// ❌ BAD: Hàm làm quá nhiều việc (validate + calculate + save + notify)
async function processOrder_BAD(
  userId: string,
  items: any[],
  email: string,
): Promise<void> {
  // validate
  if (!userId) throw new Error('No user');
  if (items.length === 0) throw new Error('No items');
  for (const item of items) {
    if (item.price < 0) throw new Error('Bad price');
    if (item.qty <= 0) throw new Error('Bad qty');
  }

  // calculate
  let total = 0;
  for (const item of items) {
    total += item.price * item.qty;
  }
  const tax = total * 0.1;
  const shipping = total > 100 ? 0 : 10;
  const grandTotal = total + tax + shipping;

  // save to db (giả lập)
  console.log(`Saving order for ${userId}: $${grandTotal}`);

  // send email
  console.log(`Sending email to ${email}`);
}

// ✅ GOOD: Tách thành nhiều hàm, mỗi hàm một trách nhiệm
interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface OrderSummary {
  subtotal: number;
  tax: number;
  shippingFee: number;
  grandTotal: number;
}

const TAX_RATE = 0.1;
const FREE_SHIPPING_THRESHOLD = 100;
const STANDARD_SHIPPING_FEE = 10;

function validateCartItems(items: CartItem[]): void {
  if (items.length === 0) {
    throw new Error('Cart must contain at least one item');
  }

  for (const item of items) {
    if (item.price < 0) throw new Error(`Invalid price for ${item.productName}`);
    if (item.quantity <= 0) throw new Error(`Invalid quantity for ${item.productName}`);
  }
}

function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calculateShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}

function calculateOrderSummary(items: CartItem[]): OrderSummary {
  const subtotal = calculateSubtotal(items);
  const tax = subtotal * TAX_RATE;
  const shippingFee = calculateShippingFee(subtotal);

  return {
    subtotal,
    tax,
    shippingFee,
    grandTotal: subtotal + tax + shippingFee,
  };
}

// ═══════════════════════════════════════════
// Rule 2.2: Tối đa 3 tham số → dùng Object
// ═══════════════════════════════════════════

// ❌ BAD: Quá nhiều tham số, khó nhớ thứ tự
function createUser_BAD(
  name: string,
  email: string,
  phone: string,
  address: string,
  role: string,
  department: string,
  isActive: boolean,
): void {
  console.log(`Creating user: ${name}`);
}

// ✅ GOOD: Gom vào object, destructure rõ ràng
interface CreateUserDto {
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'admin' | 'user' | 'manager';
  department: string;
  isActive?: boolean; // optional với default value
}

function createUser(dto: CreateUserDto): void {
  const { name, email, role, isActive = true } = dto;
  console.log(`Creating ${role} user: ${name} (${email}), active: ${isActive}`);
}

// ═══════════════════════════════════════════
// Rule 2.3: Tránh flag argument
// ═══════════════════════════════════════════

// ❌ BAD: Boolean flag làm hàm làm 2 việc khác nhau
function getUsers_BAD(includeInactive: boolean) {
  if (includeInactive) {
    return 'SELECT * FROM users';
  }
  return 'SELECT * FROM users WHERE is_active = true';
}

// ✅ GOOD: Tách thành 2 hàm rõ ràng
function getActiveUsers() {
  return 'SELECT * FROM users WHERE is_active = true';
}

function getAllUsersIncludingInactive() {
  return 'SELECT * FROM users';
}

// ═══════════════════════════════════════════
// Rule 2.4: Early Return - Giảm nesting
// ═══════════════════════════════════════════

// ❌ BAD: Nested if quá sâu (arrow anti-pattern)
function processPayment_BAD(payment: any): string {
  if (payment) {
    if (payment.amount > 0) {
      if (payment.currency) {
        if (payment.method === 'credit_card') {
          if (payment.cardNumber) {
            return 'Payment processed';
          } else {
            return 'Missing card number';
          }
        } else {
          return 'Invalid method';
        }
      } else {
        return 'Missing currency';
      }
    } else {
      return 'Invalid amount';
    }
  } else {
    return 'No payment data';
  }
}

// ✅ GOOD: Guard clauses + early return
interface PaymentRequest {
  amount: number;
  currency: string;
  method: 'credit_card' | 'bank_transfer' | 'e_wallet';
  cardNumber?: string;
}

function processPayment(payment: PaymentRequest | null): string {
  if (!payment) return 'No payment data';
  if (payment.amount <= 0) return 'Invalid amount';
  if (!payment.currency) return 'Missing currency';
  if (payment.method !== 'credit_card') return 'Invalid method';
  if (!payment.cardNumber) return 'Missing card number';

  return 'Payment processed successfully';
}

// ═══════════════════════════════════════════
// Rule 2.5: Pure Functions (Hàm thuần)
// ═══════════════════════════════════════════

// ❌ BAD: Hàm có side effect, kết quả phụ thuộc state bên ngoài
let discountRate = 0.15; // mutable global state

function calcPrice_BAD(price: number): number {
  return price * (1 - discountRate); // phụ thuộc biến ngoài
}

// ✅ GOOD: Pure function - cùng input luôn cho cùng output
function calculateDiscountedPrice(
  originalPrice: number,
  discountPercent: number,
): number {
  return originalPrice * (1 - discountPercent / 100);
}

// Kết quả luôn dự đoán được:
// calculateDiscountedPrice(100, 15) → luôn trả về 85
// calculateDiscountedPrice(200, 10) → luôn trả về 180

export {
  validateCartItems,
  calculateOrderSummary,
  createUser,
  processPayment,
  calculateDiscountedPrice,
  getActiveUsers,
  getAllUsersIncludingInactive,
};
