/**
 * ============================================
 * CLEAN CODE RULE #11: IMMUTABILITY & PURE FUNCTIONS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Không mutate object/array gốc → tạo bản mới
 * 2. Dùng readonly, Readonly<T>, ReadonlyArray<T>
 * 3. Pure function: cùng input → cùng output, không side effect
 * 4. Object spread / structuredClone thay vì direct mutation
 */

// ═══════════════════════════════════════════
// Rule 11.1: Không mutate object gốc
// ═══════════════════════════════════════════

interface Product {
  name: string;
  price: number;
  discount: number;
}

// ❌ BAD: Mutate trực tiếp → bug khó tìm, object gốc bị thay đổi
function applyDiscount_BAD(product: Product, percent: number): Product {
  product.price = product.price * (1 - percent / 100); // mutate gốc!
  product.discount = percent;
  return product; // cùng reference → caller bị ảnh hưởng
}

// ✅ GOOD: Tạo bản mới → object gốc không bị thay đổi
function applyDiscount(product: Product, percent: number): Product {
  return {
    ...product,
    price: product.price * (1 - percent / 100),
    discount: percent,
  };
}

// ═══════════════════════════════════════════
// Rule 11.2: Dùng readonly để compiler bắt mutation
// ═══════════════════════════════════════════

// ❌ BAD: Cho phép mutation bất kỳ lúc nào
interface UserConfig_BAD {
  theme: string;
  language: string;
  notifications: boolean;
}

// ✅ GOOD: Readonly → compiler báo lỗi nếu mutate
interface UserConfig {
  readonly theme: string;
  readonly language: string;
  readonly notifications: boolean;
}

function updateTheme(config: UserConfig, newTheme: string): UserConfig {
  // config.theme = newTheme; // ❌ Compile error!
  return { ...config, theme: newTheme }; // ✅ Tạo bản mới
}

// ═══════════════════════════════════════════
// Rule 11.3: ReadonlyArray — không push/pop/splice
// ═══════════════════════════════════════════

// ❌ BAD: Mutate array đầu vào
function addItem_BAD(cart: string[], item: string): string[] {
  cart.push(item); // Mutate array gốc!
  return cart;
}

// ✅ GOOD: ReadonlyArray + trả array mới
function addItem(cart: readonly string[], item: string): string[] {
  // cart.push(item); // ❌ Compile error: push not on ReadonlyArray
  return [...cart, item]; // ✅ Array mới
}

function removeItem(cart: readonly string[], index: number): string[] {
  return [...cart.slice(0, index), ...cart.slice(index + 1)];
}

// ═══════════════════════════════════════════
// Rule 11.4: Pure Functions — không side effect
// ═══════════════════════════════════════════

let globalTaxRate = 0.1; // mutable global state

// ❌ BAD: Impure — phụ thuộc vào biến global, kết quả không dự đoán được
function calculateTotal_BAD(price: number): number {
  return price * (1 + globalTaxRate); // đọc global → impure
}

// ✅ GOOD: Pure — tất cả dependency qua parameters
function calculateTotal(price: number, taxRate: number): number {
  return price * (1 + taxRate);
}

// ❌ BAD: Impure — ghi log (side effect) bên trong logic
function processScore_BAD(scores: number[]): number {
  console.log('Processing scores...'); // side effect!
  const total = scores.reduce((sum, s) => sum + s, 0);
  console.log(`Total: ${total}`); // side effect!
  return total / scores.length;
}

// ✅ GOOD: Pure — chỉ tính toán, caller quyết định log
function calculateAverage(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + s, 0);
  return total / scores.length;
}

// ═══════════════════════════════════════════
// Rule 11.5: Deep immutability cho nested objects
// ═══════════════════════════════════════════

interface Address {
  readonly street: string;
  readonly city: string;
}

interface Customer {
  readonly name: string;
  readonly address: Address;
  readonly tags: readonly string[];
}

// ❌ BAD: Shallow copy → nested object vẫn bị mutate
function updateCity_BAD(customer: Customer, newCity: string): Customer {
  const copy = { ...customer };
  // copy.address.city = newCity; // BUG: mutate cả gốc vì shallow copy!
  return copy;
}

// ✅ GOOD: Deep copy cho nested object
function updateCity(customer: Customer, newCity: string): Customer {
  return {
    ...customer,
    address: {
      ...customer.address,
      city: newCity,
    },
  };
}

// ═══════════════════════════════════════════
// Rule 11.6: Readonly utility types
// ═══════════════════════════════════════════

// Dùng Readonly<T> cho toàn bộ object
type ImmutableProduct = Readonly<Product>;

// Deep readonly helper
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type ImmutableCustomer = DeepReadonly<Customer>;

// Freeze at runtime (kết hợp compile-time readonly)
function deepFreeze<T extends object>(obj: T): DeepReadonly<T> {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return obj as DeepReadonly<T>;
}

export {
  applyDiscount,
  updateTheme,
  addItem,
  removeItem,
  calculateTotal,
  calculateAverage,
  updateCity,
  deepFreeze,
};
