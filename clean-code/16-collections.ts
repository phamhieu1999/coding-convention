/**
 * ============================================
 * CLEAN CODE RULE #16: COLLECTIONS & DATA TRANSFORMATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng higher-order functions (map, filter, reduce) thay vì manual loop
 * 2. Pipeline pattern: filter → map → reduce
 * 3. Dùng Map, Set khi phù hợp thay vì plain object
 * 4. Tránh mutation trong transformation
 * 5. Chunking, grouping, pagination
 */

// ═══════════════════════════════════════════
// Rule 16.1: Higher-order functions thay vì manual loop
// ═══════════════════════════════════════════

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

// ❌ BAD: Manual loop → dài, dễ bug, khó maintain
function getActiveProductNames_BAD(products: Product[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < products.length; i++) {
    if (products[i].inStock) {
      if (products[i].price > 0) {
        result.push(products[i].name.toUpperCase());
      }
    }
  }
  return result;
}

// ✅ GOOD: Declarative pipeline — ý nghĩa rõ ràng
function getActiveProductNames(products: readonly Product[]): string[] {
  return products
    .filter((p) => p.inStock && p.price > 0)
    .map((p) => p.name.toUpperCase());
}

// ═══════════════════════════════════════════
// Rule 16.2: Reduce cho aggregation
// ═══════════════════════════════════════════

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

// ❌ BAD: Mutable accumulator ngoài loop
function calculateOrderTotal_BAD(items: OrderItem[]): number {
  let total = 0;
  for (const item of items) {
    const subtotal = item.quantity * item.unitPrice;
    const discounted = subtotal * (1 - item.discount / 100);
    total += discounted;
  }
  return total;
}

// ✅ GOOD: Reduce — pure, no mutable state
function calculateOrderTotal(items: readonly OrderItem[]): number {
  return items.reduce((total, item) => {
    const subtotal = item.quantity * item.unitPrice;
    return total + subtotal * (1 - item.discount / 100);
  }, 0);
}

// ═══════════════════════════════════════════
// Rule 16.3: Group by — dùng Map thay Object
// ═══════════════════════════════════════════

// ❌ BAD: Dùng plain object → key chỉ là string, thiếu method
function groupByCategory_BAD(products: Product[]): Record<string, Product[]> {
  const groups: Record<string, Product[]> = {};
  for (const product of products) {
    if (!groups[product.category]) {
      groups[product.category] = [];
    }
    groups[product.category].push(product);
  }
  return groups;
}

// ✅ GOOD: Dùng Map — key bất kỳ type, có .size, iterable, ordered
function groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  return map;
}

// Sử dụng: generic, reusable
// const byCategory = groupBy(products, (p) => p.category);
// const byPriceRange = groupBy(products, (p) => Math.floor(p.price / 100) * 100);

// ═══════════════════════════════════════════
// Rule 16.4: Set cho uniqueness & lookup O(1)
// ═══════════════════════════════════════════

// ❌ BAD: Dùng array includes → O(n) mỗi lần check
function getUniqueCategories_BAD(products: Product[]): string[] {
  const categories: string[] = [];
  for (const product of products) {
    if (!categories.includes(product.category)) { // O(n) mỗi lần!
      categories.push(product.category);
    }
  }
  return categories;
}

// ✅ GOOD: Set → O(1) lookup, tự unique
function getUniqueCategories(products: readonly Product[]): string[] {
  return [...new Set(products.map((p) => p.category))];
}

// Set cho fast membership check
function filterAllowedProducts(
  products: readonly Product[],
  allowedIds: readonly string[],
): Product[] {
  const allowedSet = new Set(allowedIds); // O(1) lookup
  return products.filter((p) => allowedSet.has(p.id));
}

// ═══════════════════════════════════════════
// Rule 16.5: Chunking — xử lý data lớn
// ═══════════════════════════════════════════

// Generic chunk function — chia array thành các nhóm nhỏ
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be positive');

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

// Ứng dụng: batch processing
async function batchInsert<T>(
  items: readonly T[],
  batchSize: number,
  insertFn: (batch: T[]) => Promise<void>,
): Promise<void> {
  const batches = chunk(items, batchSize);

  for (const batch of batches) {
    await insertFn(batch);
  }
}

// ═══════════════════════════════════════════
// Rule 16.6: Pagination helper
// ═══════════════════════════════════════════

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

// ═══════════════════════════════════════════
// Rule 16.7: Chaining utility — pipe pattern
// ═══════════════════════════════════════════

// Pipeline cho data transformation — đọc từ trái sang phải
function pipe<T>(value: T, ...fns: ((v: T) => T)[]): T {
  return fns.reduce((acc, fn) => fn(acc), value);
}

// Sử dụng:
const processProducts = (products: Product[]): string[] => {
  const inStock = (ps: Product[]) => ps.filter((p) => p.inStock);
  const affordable = (ps: Product[]) => ps.filter((p) => p.price < 1000);
  const sorted = (ps: Product[]) => [...ps].sort((a, b) => a.price - b.price);

  return pipe(products, inStock, affordable, sorted)
    .map((p) => `${p.name}: $${p.price}`);
};

export {
  getActiveProductNames,
  calculateOrderTotal,
  groupBy,
  getUniqueCategories,
  filterAllowedProducts,
  chunk,
  batchInsert,
  paginate,
  pipe,
};
