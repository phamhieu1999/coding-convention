/**
 * ============================================
 * CLEAN CODE RULE #6: COMMENTS & DOCUMENTATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. Code tốt tự giải thích → ít cần comment
 * 2. Comment giải thích WHY, không phải WHAT
 * 3. Xóa code bị comment out (dùng git để track)
 * 4. Dùng JSDoc cho public API
 * 5. TODO/FIXME phải có tên người và deadline
 */

// ═══════════════════════════════════════════
// Rule 6.1: Không comment WHAT → Đặt tên rõ ràng
// ═══════════════════════════════════════════

// ❌ BAD: Comment giải thích code đang làm gì (thừa)
// Check if user is admin
function isAdmin(role: string): boolean {
  return role === 'admin'; // return true if role is admin
}

// Loop through items and calculate total
function getTotal(items: { price: number }[]): number {
  let total = 0;
  // iterate each item
  for (const item of items) {
    total += item.price; // add price to total
  }
  return total; // return the total
}

// ✅ GOOD: Code tự giải thích, comment chỉ khi cần
function calculateOrderTotal(items: { price: number }[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}

// ═══════════════════════════════════════════
// Rule 6.2: Comment giải thích WHY (lý do)
// ═══════════════════════════════════════════

// ✅ GOOD: Giải thích business rule phức tạp
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

function shouldLockAccount(failedAttempts: number): boolean {
  // Business rule: Sau 5 lần đăng nhập sai liên tiếp,
  // khóa tài khoản 30 phút theo yêu cầu bảo mật ISO 27001
  return failedAttempts >= MAX_LOGIN_ATTEMPTS;
}

// ✅ GOOD: Giải thích workaround
function parseDate(dateStr: string): Date {
  // Safari không hỗ trợ format "2024-01-15 10:30:00"
  // phải thay space bằng 'T' để tương thích cross-browser
  const isoString = dateStr.replace(' ', 'T');
  return new Date(isoString);
}

// ✅ GOOD: Giải thích performance decision
function searchProducts(query: string, products: Product[]): Product[] {
  // Dùng Map thay vì filter lặp lại vì dataset > 100k products,
  // giảm từ O(n*m) xuống O(n) theo benchmark #PR-456
  const indexMap = new Map(products.map((p) => [p.id, p]));
  return Array.from(indexMap.values()).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
}

// ═══════════════════════════════════════════
// Rule 6.3: Xóa code bị comment out
// ═══════════════════════════════════════════

// ❌ BAD: Code cũ bị comment, gây rối
function processOrder(orderId: string): void {
  // const oldPrice = getOldPrice(orderId);
  // const discount = calculateOldDiscount(oldPrice);
  // if (discount > 0) {
  //   applyOldDiscount(orderId, discount);
  // }

  // const legacyTax = oldPrice * 0.08;
  // console.log('legacy tax:', legacyTax);

  console.log(`Processing order: ${orderId}`);
}

// ✅ GOOD: Code sạch, dùng git history để xem code cũ
function processOrderClean(orderId: string): void {
  console.log(`Processing order: ${orderId}`);
}

// ═══════════════════════════════════════════
// Rule 6.4: JSDoc cho public API
// ═══════════════════════════════════════════

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

/**
 * Tính giá sau khi áp dụng coupon.
 *
 * @param originalPrice - Giá gốc sản phẩm (VND)
 * @param couponCode - Mã coupon (format: SAVE-XXXX)
 * @returns Giá sau discount, tối thiểu 0
 * @throws {InvalidCouponError} Khi coupon không hợp lệ hoặc hết hạn
 *
 * @example
 * ```ts
 * const finalPrice = applyCoupon(500000, 'SAVE-2024');
 * // Returns: 400000 (giảm 20%)
 * ```
 */
function applyCoupon(originalPrice: number, couponCode: string): number {
  const discountMap: Record<string, number> = {
    'SAVE-2024': 0.2,
    'VIP-50': 0.5,
    'WELCOME': 0.1,
  };

  const discountRate = discountMap[couponCode];
  if (discountRate === undefined) {
    throw new Error(`Invalid coupon: ${couponCode}`);
  }

  return Math.max(0, originalPrice * (1 - discountRate));
}

// ═══════════════════════════════════════════
// Rule 6.5: TODO/FIXME có context
// ═══════════════════════════════════════════

// ❌ BAD: TODO không rõ ai, khi nào
// TODO: fix this later
// FIXME: doesn't work

// ✅ GOOD: TODO đầy đủ thông tin
// TODO(@hieupv, 2025-Q2): Migrate từ REST sang GraphQL khi v2 API released
// FIXME(@hieupv, #JIRA-1234): Race condition khi 2 user cùng checkout 1 item

export { applyCoupon, calculateOrderTotal, shouldLockAccount };
