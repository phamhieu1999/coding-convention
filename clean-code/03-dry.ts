/**
 * ============================================
 * CLEAN CODE RULE #3: DRY (Don't Repeat Yourself)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Không lặp logic - trích xuất thành hàm/class chung
 * 2. Dùng generics để tái sử dụng type-safe
 * 3. Dùng composition thay vì copy-paste
 * 4. Cả business logic lẫn utility đều cần DRY
 * 5. Nhưng tránh DRY quá mức (wrong abstraction > duplication)
 */

// ═══════════════════════════════════════════
// Rule 3.1: Trích xuất logic lặp lại
// ═══════════════════════════════════════════

// ❌ BAD: Copy-paste logic format tiền ở khắp nơi
function getProductDisplay_BAD(product: any): string {
  const formattedPrice =
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(product.price);
  return `${product.name}: ${formattedPrice}`;
}

function getOrderDisplay_BAD(order: any): string {
  const formattedTotal =
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(order.total);
  return `Order #${order.id}: ${formattedTotal}`;
}

function getInvoiceDisplay_BAD(invoice: any): string {
  const formattedAmount =
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(invoice.amount);
  return `Invoice: ${formattedAmount}`;
}

// ✅ GOOD: Trích xuất utility function
type CurrencyCode = 'VND' | 'USD' | 'EUR';

function formatCurrency(amount: number, currency: CurrencyCode = 'VND'): string {
  const localeMap: Record<CurrencyCode, string> = {
    VND: 'vi-VN',
    USD: 'en-US',
    EUR: 'de-DE',
  };
  return new Intl.NumberFormat(localeMap[currency], {
    style: 'currency',
    currency,
  }).format(amount);
}

function getProductDisplay(product: { name: string; price: number }): string {
  return `${product.name}: ${formatCurrency(product.price)}`;
}

function getOrderDisplay(order: { id: string; total: number }): string {
  return `Order #${order.id}: ${formatCurrency(order.total)}`;
}

// ═══════════════════════════════════════════
// Rule 3.2: Dùng Generics để DRY type-safe
// ═══════════════════════════════════════════

// ❌ BAD: Lặp lại cấu trúc response cho mỗi entity
interface UserListResponse {
  data: { id: string; name: string }[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProductListResponse {
  data: { id: string; title: string; price: number }[];
  total: number;
  page: number;
  pageSize: number;
}

interface OrderListResponse {
  data: { id: string; status: string }[];
  total: number;
  page: number;
  pageSize: number;
}

// ✅ GOOD: Generic paginated response
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
}

function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Sử dụng: type-safe cho bất kỳ entity nào
const userResponse: PaginatedResponse<User> = createPaginatedResponse(
  [{ id: '1', name: 'John', email: 'john@mail.com' }],
  100,
  1,
  20,
);

// ═══════════════════════════════════════════
// Rule 3.3: DRY cho validation logic
// ═══════════════════════════════════════════

// ❌ BAD: Validate email lặp ở nhiều nơi
function registerUser_BAD(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error('Invalid email');
  // ...
}

function updateProfile_BAD(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error('Invalid email');
  // ...
}

function inviteUser_BAD(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error('Invalid email');
  // ...
}

// ✅ GOOD: Centralized validators
class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const Validators = {
  email(value: string): void {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(value)) {
      throw new ValidationError('email', `Invalid email: ${value}`);
    }
  },

  required(field: string, value: unknown): void {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(field, `${field} is required`);
    }
  },

  minLength(field: string, value: string, min: number): void {
    if (value.length < min) {
      throw new ValidationError(field, `${field} must be at least ${min} characters`);
    }
  },

  range(field: string, value: number, min: number, max: number): void {
    if (value < min || value > max) {
      throw new ValidationError(field, `${field} must be between ${min} and ${max}`);
    }
  },
};

// Sử dụng nhất quán ở mọi nơi:
function registerUser(email: string, password: string) {
  Validators.email(email);
  Validators.required('password', password);
  Validators.minLength('password', password, 8);
  console.log(`Registering: ${email}`);
}

function inviteUser(email: string) {
  Validators.email(email);
  console.log(`Inviting: ${email}`);
}

export {
  formatCurrency,
  createPaginatedResponse,
  Validators,
  ValidationError,
  type PaginatedResponse,
};
