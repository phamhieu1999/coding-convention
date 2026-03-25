/**
 * ============================================
 * DATABASE CONVENTION #1: NAMING CONVENTIONS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Table name: snake_case, plural (users, order_items)
 * 2. Column name: snake_case (created_at, user_id)
 * 3. Primary key: id (UUID hoặc auto-increment)
 * 4. Foreign key: <singular_table>_id (user_id, order_id)
 * 5. Index name: idx_<table>_<columns>
 * 6. Constraint name: <type>_<table>_<column>
 */

// ═══════════════════════════════════════════
// Rule 1.1: Table Naming
// ═══════════════════════════════════════════

// ❌ BAD: Inconsistent naming
const BAD_TABLE_NAMES = {
  'User':           'PascalCase, singular',
  'OrderItem':      'PascalCase, no separator',
  'order-items':    'kebab-case',
  'tbl_users':      'Hungarian notation prefix',
  'USERS':          'UPPERCASE',
  'user_data':      'Mơ hồ — data gì?',
  'product_info':   'Thừa — info không cần thiết',
};

// ✅ GOOD: snake_case, plural, domain-specific
const GOOD_TABLE_NAMES = {
  'users':                  'User accounts',
  'orders':                 'Customer orders',
  'order_items':            'Items in an order',
  'products':               'Product catalog',
  'product_categories':     'Category hierarchy',
  'payment_transactions':   'Payment records',
  'user_addresses':         'User shipping addresses',
  'refresh_tokens':         'JWT refresh tokens',
};

// ═══════════════════════════════════════════
// Rule 1.2: Column Naming
// ═══════════════════════════════════════════

// ❌ BAD
const BAD_COLUMN_NAMES = {
  'firstName':     'camelCase',
  'FirstName':     'PascalCase',
  'first-name':    'kebab-case',
  'fName':         'Abbreviation mơ hồ',
  'isactive':      'Thiếu separator',
  'data':          'Quá generic',
  'type':          'Dễ conflict với reserved word',
  'createdDate':   'camelCase + không có _at',
};

// ✅ GOOD
const GOOD_COLUMN_NAMES = {
  'id':             'UUID primary key',
  'first_name':     'snake_case',
  'last_name':      'snake_case',
  'email':          'Rõ ràng',
  'is_active':      'Boolean prefix: is_/has_/can_',
  'has_verified_email': 'Boolean with context',
  'order_status':   'Prefix tránh conflict với reserved word',
  'user_type':      'Prefix tránh conflict',
  'total_amount':   'Descriptive',
  'created_at':     'Timestamp: _at suffix',
  'updated_at':     'Timestamp: _at suffix',
  'deleted_at':     'Soft delete timestamp',
};

// ═══════════════════════════════════════════
// Rule 1.3: Foreign Key Naming
// ═══════════════════════════════════════════

// ❌ BAD
const BAD_FK_NAMES = {
  'user':          'Không có _id suffix',
  'userId':        'camelCase',
  'fk_user':       'Prefix không cần thiết',
  'user_fk_id':    'Quá dài',
};

// ✅ GOOD: <singular_table>_id
const GOOD_FK_NAMES = {
  'user_id':         'FK → users.id',
  'order_id':        'FK → orders.id',
  'product_id':      'FK → products.id',
  'category_id':     'FK → product_categories.id',
  'parent_id':       'Self-referencing FK',
  'created_by_id':   'FK → users.id (who created)',
  'updated_by_id':   'FK → users.id (who updated)',
};

// ═══════════════════════════════════════════
// Rule 1.4: Index Naming
// ═══════════════════════════════════════════

// ✅ GOOD: idx_<table>_<columns>
const INDEX_NAMING = {
  'idx_users_email':                      'Unique index on email',
  'idx_users_created_at':                 'Index for sorting',
  'idx_orders_user_id_created_at':        'Composite index',
  'idx_products_category_id_price':       'Composite for filtering',
  'idx_order_items_order_id':             'FK index',
  'uniq_users_email':                     'Unique constraint',
  'uniq_users_username':                  'Unique constraint',
};

// ═══════════════════════════════════════════
// Rule 1.5: Constraint Naming
// ═══════════════════════════════════════════

// ✅ GOOD: <type>_<table>_<column/description>
const CONSTRAINT_NAMING = {
  'pk_users':                     'Primary key',
  'fk_orders_user_id':            'Foreign key',
  'uniq_users_email':             'Unique constraint',
  'chk_orders_total_positive':    'Check constraint: total > 0',
  'chk_users_age_range':          'Check constraint: age 1-150',
  'def_users_is_active':          'Default value constraint',
};

// ═══════════════════════════════════════════
// Rule 1.6: TypeORM Entity Convention
// ═══════════════════════════════════════════

// ❌ BAD: Entity không match database naming
/*
@Entity() // Table name = class name (camelCase)
export class OrderItem {
  @Column()
  productId: string; // Column = productId (camelCase not snake_case)
}
*/

// ✅ GOOD: Explicit naming
/*
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'quantity', type: 'int' })
  quantity: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // Hoặc dùng NamingStrategy global:
  // new SnakeNamingStrategy() → tự convert camelCase → snake_case
}
*/

// ═══════════════════════════════════════════
// Rule 1.7: Enum & Status Columns
// ═══════════════════════════════════════════

// ❌ BAD: Integer status — không ai biết 1, 2, 3 là gì
/*
@Column({ type: 'int', default: 0 })
status: number;
// WHERE status = 3 → 3 là gì??
*/

// ✅ GOOD: String enum — readable trong query
/*
enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Column({
  name: 'order_status',
  type: 'varchar',
  length: 20,
  default: OrderStatus.PENDING,
})
status: OrderStatus;
// WHERE order_status = 'shipped' → readable!
*/

export {
  GOOD_TABLE_NAMES,
  GOOD_COLUMN_NAMES,
  GOOD_FK_NAMES,
  INDEX_NAMING,
  CONSTRAINT_NAMING,
};
