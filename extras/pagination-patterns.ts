/**
 * ============================================
 * PAGINATION PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Offset-based — đơn giản, phổ biến
 * 2. Cursor-based — hiệu năng tốt hơn cho large datasets
 * 3. Keyset pagination — nhanh nhất, stable
 * 4. Response format chuẩn
 * 5. Tối ưu query với index
 */

// ═══════════════════════════════════════════
// Rule 1: Offset-Based Pagination
// ═══════════════════════════════════════════

// ❌ BAD: Không pagination → load hết data
/*
async findAll(): Promise<User[]> {
  return this.userRepo.find(); // 1 triệu records??
}
*/

// ✅ GOOD: Offset pagination
interface PaginationQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

async function paginateOffset<T>(
  items: T[],
  totalCount: number,
  query: PaginationQuery,
): Promise<PaginatedResponse<T>> {
  const { page, limit } = query;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: items,
    meta: {
      page,
      limit,
      totalItems: totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// SQL: SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET 20
// ⚠️ OFFSET lớn → chậm (DB phải scan qua N rows rồi skip)

// ═══════════════════════════════════════════
// Rule 2: Cursor-Based Pagination
// ═══════════════════════════════════════════

// ✅ GOOD: Cursor pagination — efficient cho large datasets
interface CursorPaginationQuery {
  first?: number;    // Forward: lấy N items đầu
  after?: string;    // Forward: sau cursor này
  last?: number;     // Backward: lấy N items cuối
  before?: string;   // Backward: trước cursor này
}

interface Edge<T> {
  cursor: string;
  node: T;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

// Cursor = encoded unique identifier (usually base64 of id or timestamp)
function encodeCursor(value: string): string {
  // In browser/node: btoa(value) or Buffer.from(value).toString('base64')
  return `cursor_${value}`;
}

function decodeCursor(cursor: string): string {
  return cursor.replace('cursor_', '');
}

function buildCursorConnection<T extends { id: string }>(
  items: T[],
  totalCount: number,
  hasMore: boolean,
): Connection<T> {
  const edges: Edge<T>[] = items.map(item => ({
    cursor: encodeCursor(item.id),
    node: item,
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: hasMore,
      hasPreviousPage: false, // Simplified
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
    },
    totalCount,
  };
}

// SQL: SELECT * FROM users WHERE id > :cursor ORDER BY id ASC LIMIT 11
// Lấy 11 rows, trả 10 → hasNextPage = true nếu có row thứ 11

// ═══════════════════════════════════════════
// Rule 3: Keyset Pagination
// ═══════════════════════════════════════════

// ✅ GOOD: Keyset — nhanh nhất, stable ordering
interface KeysetQuery {
  limit: number;
  afterId?: string;
  afterCreatedAt?: string;
}

// SQL cho keyset pagination:
// SELECT * FROM orders
// WHERE (created_at, id) > (:lastCreatedAt, :lastId)
// ORDER BY created_at DESC, id DESC
// LIMIT 10

// Ưu điểm:
// - O(1) performance bất kể page number
// - Stable — không bị skip/duplicate khi data thay đổi
// - Tận dụng index (created_at, id)

// ═══════════════════════════════════════════
// Rule 4: So sánh
// ═══════════════════════════════════════════

const PAGINATION_COMPARISON = {
  offset: {
    sql: 'SELECT * FROM t ORDER BY id LIMIT :limit OFFSET :offset',
    pros: ['Đơn giản', 'Jump to page N', 'Dễ implement'],
    cons: ['Chậm ở page lớn (OFFSET 100000)', 'Unstable (insert/delete shift data)'],
    bestFor: 'Admin panels, small datasets (< 100K rows)',
  },
  cursor: {
    sql: 'SELECT * FROM t WHERE id > :cursor ORDER BY id LIMIT :limit',
    pros: ['O(1) performance', 'Stable', 'GraphQL standard (Relay)'],
    cons: ['Không jump to page N', 'Phức tạp hơn offset'],
    bestFor: 'Feeds, timelines, mobile infinite scroll, GraphQL API',
  },
  keyset: {
    sql: 'SELECT * FROM t WHERE (col, id) > (:val, :id) ORDER BY col, id LIMIT :limit',
    pros: ['Nhanh nhất', 'Stable', 'Multi-column sort'],
    cons: ['Complex implementation', 'Cần composite index'],
    bestFor: 'Large datasets, real-time feeds, high-performance APIs',
  },
};

// ═══════════════════════════════════════════
// Rule 5: NestJS Implementation
// ═══════════════════════════════════════════

// ✅ GOOD: Reusable pagination decorator + pipe
const nestjsPaginationExample = `
// pagination.dto.ts
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

// Usage in service:
async findAll(dto: PaginationDto): Promise<PaginatedResponse<User>> {
  const [items, total] = await this.userRepo.findAndCount({
    skip: dto.skip,
    take: dto.limit,
    order: { [dto.sortBy || 'createdAt']: dto.sortOrder },
  });

  return {
    data: items,
    meta: {
      page: dto.page,
      limit: dto.limit,
      totalItems: total,
      totalPages: Math.ceil(total / dto.limit),
      hasNextPage: dto.page < Math.ceil(total / dto.limit),
      hasPrevPage: dto.page > 1,
    },
  };
}
`;

// ═══════════════════════════════════════════
// Rule 6: Index Strategy for Pagination
// ═══════════════════════════════════════════

const INDEX_TIPS = {
  offset: 'CREATE INDEX idx_users_created_at ON users (created_at DESC)',
  cursor: 'CREATE INDEX idx_users_id ON users (id)  -- Primary key already indexed',
  keyset: 'CREATE INDEX idx_orders_date_id ON orders (created_at DESC, id DESC)',
  search: 'CREATE INDEX idx_users_name_gin ON users USING gin (name gin_trgm_ops)',
  tip: 'Luôn EXPLAIN ANALYZE query pagination để verify index được sử dụng',
};

export {
  paginateOffset,
  buildCursorConnection,
  encodeCursor,
  decodeCursor,
  nestjsPaginationExample,
  PAGINATION_COMPARISON,
  INDEX_TIPS,
  type PaginationQuery,
  type PaginatedResponse,
  type CursorPaginationQuery,
  type Connection,
  type Edge,
  type PageInfo,
  type KeysetQuery,
};
