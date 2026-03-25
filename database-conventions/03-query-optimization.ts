/**
 * ============================================
 * DATABASE CONVENTION #3: QUERY OPTIMIZATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. Tránh N+1 query — dùng JOIN hoặc batch loading
 * 2. Indexing strategy — tạo index cho WHERE, JOIN, ORDER BY
 * 3. SELECT chỉ fields cần thiết — không SELECT *
 * 4. EXPLAIN ANALYZE trước khi deploy query phức tạp
 * 5. Pagination ở database level (LIMIT/OFFSET hoặc cursor)
 * 6. Denormalize khi cần thiết cho read-heavy operations
 */

// ═══════════════════════════════════════════
// Rule 3.1: N+1 Query Detection & Fix
// ═══════════════════════════════════════════

// ❌ BAD: N+1 — 1 query list + N queries cho relations
/*
async getOrdersWithDetails(): Promise<any[]> {
  const orders = await this.orderRepo.find(); // Query 1: SELECT * FROM orders

  return Promise.all(orders.map(async (order) => {
    const user = await this.userRepo.findOne({      // Query 2, 3, 4...
      where: { id: order.userId },
    });
    const items = await this.itemRepo.find({         // Query N+2, N+3...
      where: { orderId: order.id },
    });
    return { ...order, user, items };
  }));
  // 100 orders = 1 + 100 (users) + 100 (items) = 201 queries!
}
*/

// ✅ GOOD: JOIN trong 1 query
/*
async getOrdersWithDetails(): Promise<Order[]> {
  return this.orderRepo
    .createQueryBuilder('order')
    .leftJoinAndSelect('order.user', 'user')
    .leftJoinAndSelect('order.items', 'item')
    .select([
      'order.id', 'order.totalAmount', 'order.status', 'order.createdAt',
      'user.id', 'user.email', 'user.firstName',
      'item.id', 'item.productName', 'item.quantity', 'item.unitPrice',
    ])
    .orderBy('order.createdAt', 'DESC')
    .take(20)
    .getMany();
  // 1 QUERY tổng hợp tất cả!
}
*/

// ═══════════════════════════════════════════
// Rule 3.2: Batch Loading (DataLoader Pattern)
// ═══════════════════════════════════════════

// ✅ GOOD: Batch nhiều ID thành 1 query (dùng cho GraphQL hoặc REST)
class BatchUserLoader {
  private pendingIds: string[] = [];
  private cache = new Map<string, unknown>();

  async loadById(id: string): Promise<unknown> {
    if (this.cache.has(id)) return this.cache.get(id);
    this.pendingIds.push(id);
    return this.flush().then(() => this.cache.get(id));
  }

  private async flush(): Promise<void> {
    if (this.pendingIds.length === 0) return;
    const ids = [...new Set(this.pendingIds)];
    this.pendingIds = [];

    // 1 query thay vì N queries
    // SELECT * FROM users WHERE id IN ('id1', 'id2', 'id3')
    const users = ids.map(id => ({ id, name: `User ${id}` }));
    users.forEach(u => this.cache.set(u.id, u));
  }
}

// ═══════════════════════════════════════════
// Rule 3.3: Index Strategy
// ═══════════════════════════════════════════

// ❌ BAD: Không có index cho columns thường query
/*
-- Table có 1 triệu rows, không index
SELECT * FROM orders WHERE user_id = '123';       -- Full table scan!
SELECT * FROM orders WHERE status = 'pending';     -- Full table scan!
SELECT * FROM orders ORDER BY created_at DESC;     -- Filesort!
*/

// ✅ GOOD: Index cho columns dùng trong WHERE, JOIN, ORDER BY
const INDEX_STRATEGY = {
  // Single column indexes
  'Equality filter':
    "CREATE INDEX idx_orders_user_id ON orders(user_id);",
  'Status filter':
    "CREATE INDEX idx_orders_status ON orders(order_status);",
  'Sorting':
    "CREATE INDEX idx_orders_created_at ON orders(created_at DESC);",
  'Unique lookup':
    "CREATE UNIQUE INDEX idx_users_email ON users(email);",

  // Composite indexes — column ORDER matters!
  'Filter + Sort':
    "CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);",
  'Multi-filter':
    "CREATE INDEX idx_products_category_status ON products(category_id, is_active);",
  'Covering index':
    "CREATE INDEX idx_orders_status_total ON orders(order_status) INCLUDE (total_amount);",

  // Partial index — chỉ index rows cần thiết
  'Active orders only':
    "CREATE INDEX idx_orders_active ON orders(created_at) WHERE order_status != 'cancelled';",
};

// ═══════════════════════════════════════════
// Rule 3.4: Composite Index Column Order
// ═══════════════════════════════════════════

/*
Composite index (A, B, C) hỗ trợ queries cho:
  ✅ WHERE A = ?
  ✅ WHERE A = ? AND B = ?
  ✅ WHERE A = ? AND B = ? AND C = ?
  ✅ WHERE A = ? ORDER BY B
  ❌ WHERE B = ?          ← KHÔNG dùng được index!
  ❌ WHERE C = ?          ← KHÔNG dùng được index!
  ❌ WHERE B = ? AND C = ? ← KHÔNG dùng được index!

→ Rule: Equality columns TRƯỚC, range/sort columns SAU
→ Selectivity: Column có nhiều distinct values hơn để TRƯỚC

Ví dụ: Query WHERE user_id = ? AND status = ? ORDER BY created_at DESC
→ Index: (user_id, status, created_at DESC)
  └── Equality     └── Equality  └── Sort
*/

// ═══════════════════════════════════════════
// Rule 3.5: SELECT Fields — Không SELECT *
// ═══════════════════════════════════════════

// ❌ BAD: SELECT *
/*
SELECT * FROM users;
-- Trả về ALL columns: id, email, password, salt, phone, address,
-- avatar_url, bio, settings_json, ... (20+ columns)
-- Bandwidth wasted, memory wasted
*/

// ✅ GOOD: SELECT chỉ cần thiết
/*
-- Cho list page
SELECT id, email, first_name, last_name, is_active, created_at
FROM users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- Cho detail page — nhiều fields hơn nhưng vẫn không có password
SELECT id, email, first_name, last_name, phone, avatar_url, bio, created_at
FROM users
WHERE id = $1;
*/

// ═══════════════════════════════════════════
// Rule 3.6: EXPLAIN ANALYZE
// ═══════════════════════════════════════════

// ✅ GOOD: Luôn EXPLAIN trước khi deploy query phức tạp
/*
EXPLAIN ANALYZE
SELECT o.id, o.total_amount, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.order_status = 'pending'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 20;

-- Kiểm tra:
-- ✅ "Index Scan" hoặc "Index Only Scan" → tốt
-- ❌ "Seq Scan" trên table lớn → cần thêm index
-- ❌ "Sort" → cần ORDER BY index
-- ❌ "Hash Join" trên table lớn → kiểm tra FK index
-- ⚠️ "Bitmap Heap Scan" → ok cho medium selectivity

-- Metrics cần chú ý:
-- actual time: thời gian thực tế
-- rows: số rows scan vs rows returned (ratio lớn = inefficient)
-- loops: số lần loop (N+1 indicator)
*/

// ═══════════════════════════════════════════
// Rule 3.7: Query Anti-Patterns
// ═══════════════════════════════════════════

const QUERY_ANTI_PATTERNS = {
  'COUNT(*) trên large table': {
    bad: 'SELECT COUNT(*) FROM orders; -- 10M rows → slow!',
    good: 'Dùng approximate count hoặc cache (Redis)',
  },
  'LIKE với leading wildcard': {
    bad: "WHERE name LIKE '%keyword%' -- Không dùng index!",
    good: "WHERE name LIKE 'keyword%' -- Dùng index, hoặc dùng Full-Text Search (tsvector)",
  },
  'OR trên khác columns': {
    bad: "WHERE email = 'x' OR phone = 'y' -- Khó optimize",
    good: 'UNION hai queries hoặc dùng GIN index',
  },
  'Function trên indexed column': {
    bad: "WHERE LOWER(email) = 'x' -- Index trên email không dùng được!",
    good: "CREATE INDEX idx_users_email_lower ON users(LOWER(email)); -- Functional index",
  },
  'NOT IN với subquery': {
    bad: 'WHERE id NOT IN (SELECT user_id FROM blocked) -- Slow with NULLs',
    good: 'WHERE NOT EXISTS (SELECT 1 FROM blocked WHERE blocked.user_id = users.id)',
  },
};

export {
  BatchUserLoader,
  INDEX_STRATEGY,
  QUERY_ANTI_PATTERNS,
};
