/**
 * ============================================
 * API DESIGN #3: PAGINATION & FILTERING
 * ============================================
 *
 * Nguyên tắc:
 * 1. LUÔN paginate list endpoints — không bao giờ trả toàn bộ data
 * 2. Offset pagination cho UI đơn giản (page 1, 2, 3)
 * 3. Cursor pagination cho infinite scroll, realtime feed
 * 4. Filter + sort dùng query params
 * 5. Response metadata rõ ràng (total, hasNext, etc.)
 */

declare const Buffer: {
  from(data: string, encoding?: string): { toString(encoding?: string): string };
};

// ═══════════════════════════════════════════
// Rule 3.1: LUÔN Paginate
// ═══════════════════════════════════════════

// ❌ BAD: Trả tất cả records
/*
@Get()
async findAll(): Promise<User[]> {
  return this.userRepo.find(); // 100,000 records → OOM!
}
*/

// ✅ GOOD: Default pagination
class PaginationQueryDto {
  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  page: number = 1;

  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // @Min(1)
  // @Max(100)
  limit: number = 20;
}

// ═══════════════════════════════════════════
// Rule 3.2: Offset Pagination
// ═══════════════════════════════════════════

// GET /api/v1/users?page=2&limit=20

interface OffsetPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

async function findWithOffsetPagination(
  page: number,
  limit: number,
): Promise<OffsetPaginatedResponse<unknown>> {
  const skip = (page - 1) * limit;
  const total = 150; // Simulate COUNT(*)
  const data: unknown[] = []; // Simulate query

  /*
  const [data, total] = await this.repo.findAndCount({
    skip,
    take: limit,
    order: { createdAt: 'DESC' },
  });
  */

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: skip + limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

// ⚠️ Nhược điểm offset pagination:
// - Page drift khi data thay đổi (insert/delete giữa 2 requests)
// - Performance kém khi offset lớn (OFFSET 100000 → scan 100k rows)
// → Dùng cursor pagination cho feed/timeline

// ═══════════════════════════════════════════
// Rule 3.3: Cursor Pagination (Recommended)
// ═══════════════════════════════════════════

// GET /api/v1/posts?cursor=eyJpZCI6MTAwfQ&limit=20

interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
    limit: number;
  };
}

function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

async function findWithCursorPagination(
  cursor: string | undefined,
  limit: number,
): Promise<CursorPaginatedResponse<{ id: string; createdAt: Date }>> {
  // Decode cursor
  const decodedCursor = cursor ? decodeCursor(cursor) : null;

  /*
  const qb = this.repo.createQueryBuilder('post')
    .orderBy('post.createdAt', 'DESC')
    .addOrderBy('post.id', 'DESC')
    .take(limit + 1); // Fetch 1 extra để check hasNextPage

  if (decodedCursor) {
    qb.andWhere(
      '(post.createdAt, post.id) < (:createdAt, :id)',
      { createdAt: decodedCursor.createdAt, id: decodedCursor.id },
    );
  }

  const results = await qb.getMany();
  */

  const results: { id: string; createdAt: Date }[] = []; // Simulate
  const hasNextPage = results.length > limit;
  const data = hasNextPage ? results.slice(0, -1) : results;

  const lastItem = data[data.length - 1];
  const firstItem = data[0];

  return {
    data,
    meta: {
      hasNextPage,
      hasPreviousPage: !!cursor,
      nextCursor: hasNextPage && lastItem
        ? encodeCursor({ id: lastItem.id, createdAt: lastItem.createdAt })
        : null,
      previousCursor: firstItem
        ? encodeCursor({ id: firstItem.id, createdAt: firstItem.createdAt })
        : null,
      limit,
    },
  };
}

// ═══════════════════════════════════════════
// Rule 3.4: Filtering
// ═══════════════════════════════════════════

// ❌ BAD: Filter logic hardcode trong controller
/*
@Get()
async findAll(@Query() query: any) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.role) where.role = query.role;
  if (query.name) where.name = Like(`%${query.name}%`); // SQL injection risk!
  return this.repo.find({ where });
}
*/

// ✅ GOOD: Typed filter DTO + query builder
class UserFilterDto extends PaginationQueryDto {
  // @IsOptional() @IsEnum(UserStatus)
  status?: string;

  // @IsOptional() @IsEnum(UserRole)
  role?: string;

  // @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  // @IsOptional() @IsDateString()
  createdAfter?: string;

  // @IsOptional() @IsDateString()
  createdBefore?: string;

  // @IsOptional() @IsIn(['createdAt', 'email', 'name'])
  sortBy?: string;

  // @IsOptional() @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

// Repository method:
/*
async findFiltered(filters: UserFilterDto): Promise<OffsetPaginatedResponse<User>> {
  const qb = this.repo.createQueryBuilder('user');

  // Parameterized queries — safe from injection
  if (filters.status) {
    qb.andWhere('user.status = :status', { status: filters.status });
  }

  if (filters.role) {
    qb.andWhere('user.role = :role', { role: filters.role });
  }

  if (filters.search) {
    qb.andWhere(
      '(user.firstName ILIKE :search OR user.email ILIKE :search)',
      { search: `%${filters.search}%` },
    );
  }

  if (filters.createdAfter) {
    qb.andWhere('user.createdAt >= :after', { after: filters.createdAfter });
  }

  if (filters.createdBefore) {
    qb.andWhere('user.createdAt <= :before', { before: filters.createdBefore });
  }

  // Sorting
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'DESC';
  qb.orderBy(`user.${sortBy}`, sortOrder);

  // Pagination
  const skip = (filters.page - 1) * filters.limit;
  qb.skip(skip).take(filters.limit);

  const [data, total] = await qb.getManyAndCount();

  return {
    data,
    meta: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      hasNextPage: skip + filters.limit < total,
      hasPreviousPage: filters.page > 1,
    },
  };
}
*/

// ═══════════════════════════════════════════
// Rule 3.5: Khi nào dùng Offset vs Cursor?
// ═══════════════════════════════════════════

/*
┌────────────────────┬────────────────────┬────────────────────────┐
│                    │ Offset Pagination  │ Cursor Pagination      │
├────────────────────┼────────────────────┼────────────────────────┤
│ Use case           │ Admin tables,      │ Social feed, timeline, │
│                    │ search results     │ infinite scroll        │
├────────────────────┼────────────────────┼────────────────────────┤
│ Jump to page       │ ✅ page=5          │ ❌ Chỉ next/prev       │
├────────────────────┼────────────────────┼────────────────────────┤
│ Total count        │ ✅ Biết total      │ ❌ Thường không biết   │
├────────────────────┼────────────────────┼────────────────────────┤
│ Performance (lớn)  │ ❌ Chậm khi offset │ ✅ Constant time       │
│                    │   lớn (100k+)      │                        │
├────────────────────┼────────────────────┼────────────────────────┤
│ Data consistency   │ ❌ Page drift       │ ✅ Stable cursor       │
├────────────────────┼────────────────────┼────────────────────────┤
│ Implementation     │ ✅ Đơn giản        │ ⚠️ Phức tạp hơn       │
└────────────────────┴────────────────────┴────────────────────────┘
*/

export {
  PaginationQueryDto,
  UserFilterDto,
  findWithOffsetPagination,
  findWithCursorPagination,
  encodeCursor,
  decodeCursor,
  type OffsetPaginatedResponse,
  type CursorPaginatedResponse,
};
