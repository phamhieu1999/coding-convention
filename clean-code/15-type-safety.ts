/**
 * ============================================
 * CLEAN CODE RULE #15: TYPE SAFETY & TYPE GUARDS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Tránh `any` → dùng `unknown` khi chưa biết type
 * 2. Custom type guards (`is`, `asserts`)
 * 3. Discriminated unions thay vì optional fields
 * 4. Exhaustive switch check (never)
 * 5. Template literal types cho string patterns
 */

// ═══════════════════════════════════════════
// Rule 15.1: Tránh any → dùng unknown + type narrowing
// ═══════════════════════════════════════════

// ❌ BAD: any → mất hoàn toàn type safety
function parseJSON_BAD(data: string): any {
  return JSON.parse(data); // Trả any → caller dùng sai không biết
}

const result_BAD = parseJSON_BAD('{"name": 1}');
// result_BAD.name.toUpperCase(); // Runtime error! name là number

// ✅ GOOD: unknown + validation → type-safe
function parseJSON<T>(data: string, validator: (value: unknown) => value is T): T {
  const parsed: unknown = JSON.parse(data);
  if (!validator(parsed)) {
    throw new Error('Invalid data format');
  }
  return parsed;
}

// Type guard function
interface UserData {
  name: string;
  age: number;
}

function isUserData(value: unknown): value is UserData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'age' in value &&
    typeof (value as UserData).name === 'string' &&
    typeof (value as UserData).age === 'number'
  );
}

// Sử dụng: type-safe hoàn toàn
const user = parseJSON('{"name": "John", "age": 30}', isUserData);
// user.name → string ✅ (TypeScript biết chắc)

// ═══════════════════════════════════════════
// Rule 15.2: Discriminated Unions thay vì optional fields
// ═══════════════════════════════════════════

// ❌ BAD: Optional fields → state không hợp lệ vẫn compile được
interface Notification_BAD {
  type: string;
  email?: string;      // Cho email notification
  phoneNumber?: string; // Cho SMS notification
  deviceToken?: string; // Cho push notification
  message: string;
}
// Vấn đề: có thể tạo { type: 'email', phoneNumber: '123' } → vô nghĩa

// ✅ GOOD: Discriminated union → mỗi type có đúng fields cần thiết
type Notification =
  | { type: 'email'; email: string; subject: string; body: string }
  | { type: 'sms'; phoneNumber: string; message: string }
  | { type: 'push'; deviceToken: string; title: string; body: string };

// TypeScript tự narrow type theo discriminant field
function sendNotification(notification: Notification): void {
  switch (notification.type) {
    case 'email':
      // notification.email → string ✅ (tự narrow)
      console.log(`Email to ${notification.email}: ${notification.subject}`);
      break;
    case 'sms':
      // notification.phoneNumber → string ✅
      console.log(`SMS to ${notification.phoneNumber}: ${notification.message}`);
      break;
    case 'push':
      // notification.deviceToken → string ✅
      console.log(`Push to ${notification.deviceToken}: ${notification.title}`);
      break;
  }
}

// ═══════════════════════════════════════════
// Rule 15.3: Exhaustive switch — bắt missing case lúc compile
// ═══════════════════════════════════════════

type PaymentMethod = 'credit_card' | 'bank_transfer' | 'crypto';

// ❌ BAD: Dùng default → thêm type mới sẽ bị bỏ qua im lặng
function getPaymentFee_BAD(method: PaymentMethod): number {
  switch (method) {
    case 'credit_card': return 2.9;
    case 'bank_transfer': return 0.5;
    default: return 0; // Nếu thêm 'crypto' → không ai biết cần handle
  }
}

// ✅ GOOD: Exhaustive check → compile error nếu thiếu case
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}

function getPaymentFee(method: PaymentMethod): number {
  switch (method) {
    case 'credit_card': return 2.9;
    case 'bank_transfer': return 0.5;
    case 'crypto': return 1.0;
    default: return assertNever(method);
    // Nếu thêm type mới mà quên handle → compile error!
  }
}

// ═══════════════════════════════════════════
// Rule 15.4: Template Literal Types
// ═══════════════════════════════════════════

// ❌ BAD: string quá loose → typo không bắt được
function setColor_BAD(color: string) {
  // setColor_BAD('redd') → runtime bug, compile OK
}

// ✅ GOOD: Template literal types → chỉ cho phép format hợp lệ
type HexColor = `#${string}`;
type RGBColor = `rgb(${number}, ${number}, ${number})`;
type CSSColor = HexColor | RGBColor | 'transparent';

function setColor(color: CSSColor): void {
  console.log(`Setting color: ${color}`);
}

// ✅ Compile OK
setColor('#ff0000');
setColor('rgb(255, 0, 0)');
setColor('transparent');

// Event names with type-safe prefix
type EventName = `on${Capitalize<'click' | 'hover' | 'focus' | 'blur'>}`;
// EventName = 'onClick' | 'onHover' | 'onFocus' | 'onBlur'

type EventHandler = {
  [K in EventName]?: () => void;
};

// ═══════════════════════════════════════════
// Rule 15.5: Branded Types — tránh nhầm lẫn primitive
// ═══════════════════════════════════════════

// ❌ BAD: Cả userId và orderId đều là string → dễ truyền nhầm
function getOrder_BAD(userId: string, orderId: string): void {
  // getOrder_BAD(orderId, userId) → BUG! Nhưng compile OK
}

// ✅ GOOD: Branded types → compile error nếu truyền nhầm
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

function createUserId(id: string): UserId { return id as UserId; }
function createOrderId(id: string): OrderId { return id as OrderId; }

function getOrder(userId: UserId, orderId: OrderId): void {
  console.log(`Fetching order ${orderId} for user ${userId}`);
}

const userId = createUserId('user-1');
const orderId = createOrderId('order-1');
getOrder(userId, orderId); // ✅ OK
// getOrder(orderId, userId); // ❌ Compile error! Không nhầm được

// ═══════════════════════════════════════════
// Rule 15.6: Utility types cho type transformation
// ═══════════════════════════════════════════

interface FullUser {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

// Tạo type từ type có sẵn thay vì duplicate
type CreateUserDTO = Omit<FullUser, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateUserDTO = Partial<Pick<FullUser, 'name' | 'email'>>;
type PublicUser = Omit<FullUser, 'password'>;

// Required khi API response cần đầy đủ
type UserResponse = Required<PublicUser>;

export {
  parseJSON,
  isUserData,
  type Notification,
  sendNotification,
  getPaymentFee,
  assertNever,
  setColor,
  getOrder,
  createUserId,
  createOrderId,
  type CreateUserDTO,
  type UpdateUserDTO,
  type PublicUser,
};
