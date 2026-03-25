/**
 * ============================================
 * NESTJS CONVENTION #4: REPOSITORY PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Repository = data access layer — tách khỏi business logic
 * 2. Custom Repository thay vì gọi trực tiếp EntityManager
 * 3. Select chỉ fields cần thiết (tránh SELECT *)
 * 4. Soft delete thay vì hard delete
 * 5. Tối ưu query: index, relations, query builder
 * 6. Pagination built-in
 */

// ═══════════════════════════════════════════
// Rule 4.1: Custom Repository
// ═══════════════════════════════════════════

// ❌ BAD: Gọi repository trực tiếp trong service, logic lẫn lộn
/*
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async findActiveUsers() {
    return this.userRepo.find({
      where: { isActive: true, deletedAt: IsNull() },
      relations: ['profile', 'roles'],
      select: ['id', 'email', 'firstName'],
      order: { createdAt: 'DESC' },
    }); // Query logic lẫn trong service
  }
}
*/

// ✅ GOOD: Custom Repository tách riêng data access
/*
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findActiveUsers(): Promise<User[]> {
    return this.repo.find({
      where: { isActive: true, deletedAt: IsNull() },
      relations: ['profile', 'roles'],
      select: ['id', 'email', 'firstName'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4.2: Select Fields — Tránh SELECT *
// ═══════════════════════════════════════════

// ❌ BAD: Load toàn bộ entity + tất cả relations
/*
async findAll(): Promise<User[]> {
  return this.repo.find({
    relations: ['profile', 'orders', 'orders.items', 'orders.items.product'],
  });
  // SELECT * FROM users
  // LEFT JOIN profiles ...
  // LEFT JOIN orders ...
  // → Load cả password, internal fields, và hàng nghìn orders
}
*/

// ✅ GOOD: Select chỉ fields cần thiết
/*
async findAllForList(): Promise<UserListItem[]> {
  return this.repo
    .createQueryBuilder('user')
    .select(['user.id', 'user.email', 'user.firstName', 'user.createdAt'])
    .leftJoin('user.profile', 'profile')
    .addSelect(['profile.avatarUrl'])
    .where('user.isActive = :isActive', { isActive: true })
    .orderBy('user.createdAt', 'DESC')
    .getMany();
}
*/

// ═══════════════════════════════════════════
// Rule 4.3: Soft Delete
// ═══════════════════════════════════════════

// ❌ BAD: Hard delete — mất data vĩnh viễn
/*
async deleteUser(id: string): Promise<void> {
  await this.repo.delete(id); // Gone forever!
}
*/

// ✅ GOOD: Soft delete với deletedAt column
/*
// Entity
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @DeleteDateColumn()
  deletedAt: Date | null; // TypeORM tự filter trong find()

  @Column({ default: true })
  isActive: boolean;
}

// Repository
@Injectable()
export class UserRepository {
  async softRemove(id: string): Promise<void> {
    await this.repo.softDelete(id); // SET deletedAt = NOW()
  }

  async restore(id: string): Promise<void> {
    await this.repo.restore(id); // SET deletedAt = NULL
  }

  // Tìm cả đã xóa (admin)
  async findWithDeleted(): Promise<User[]> {
    return this.repo.find({ withDeleted: true });
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4.4: Pagination
// ═══════════════════════════════════════════

// ❌ BAD: Load tất cả rồi slice
/*
async findAll(): Promise<User[]> {
  const users = await this.repo.find(); // Load 100k records!
  return users.slice(0, 20);
}
*/

// ✅ GOOD: Database-level pagination
interface PaginationInput {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
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

async function findPaginated<T>(
  _input: PaginationInput,
): Promise<PaginatedResult<T>> {
  const { page, limit } = _input;
  const skip = (page - 1) * limit;

  // Simulate DB query
  const total = 100;
  const data: T[] = [];

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

// ═══════════════════════════════════════════
// Rule 4.5: Query Builder cho Complex Queries
// ═══════════════════════════════════════════

// ❌ BAD: Raw SQL string — SQL injection risk
/*
async searchUsers(keyword: string): Promise<User[]> {
  return this.repo.query(
    `SELECT * FROM users WHERE name LIKE '%${keyword}%'` // SQL INJECTION!
  );
}
*/

// ✅ GOOD: Query builder với parameterized queries
/*
async searchUsers(filters: UserSearchFilters): Promise<PaginatedResult<User>> {
  const qb = this.repo.createQueryBuilder('user');

  if (filters.keyword) {
    qb.andWhere(
      '(user.firstName ILIKE :keyword OR user.email ILIKE :keyword)',
      { keyword: `%${filters.keyword}%` },
    );
  }

  if (filters.role) {
    qb.andWhere('user.role = :role', { role: filters.role });
  }

  if (filters.createdAfter) {
    qb.andWhere('user.createdAt >= :after', { after: filters.createdAfter });
  }

  // Sorting
  const sortField = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'DESC';
  qb.orderBy(`user.${sortField}`, sortOrder);

  // Pagination
  qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

  const [data, total] = await qb.getManyAndCount();
  return buildPaginatedResult(data, total, filters.page, filters.limit);
}
*/

// ═══════════════════════════════════════════
// Rule 4.6: Tránh N+1 Query
// ═══════════════════════════════════════════

// ❌ BAD: N+1 — 1 query cho list + N queries cho mỗi relation
/*
async getOrdersWithUser(): Promise<any[]> {
  const orders = await this.orderRepo.find(); // Query 1

  return Promise.all(orders.map(async (order) => {
    const user = await this.userRepo.findOne({ // Query 2, 3, 4, ... N
      where: { id: order.userId },
    });
    return { ...order, user };
  }));
}
*/

// ✅ GOOD: Eager load relations trong 1 query
/*
async getOrdersWithUser(): Promise<Order[]> {
  return this.orderRepo.find({
    relations: ['user'],              // JOIN trong 1 query
    select: {
      user: { id: true, email: true }, // Chỉ select fields cần thiết
    },
  });
}

// Hoặc dùng QueryBuilder cho control tốt hơn:
async getOrdersWithUser(): Promise<Order[]> {
  return this.orderRepo
    .createQueryBuilder('order')
    .leftJoinAndSelect('order.user', 'user')
    .select(['order.id', 'order.total', 'user.id', 'user.email'])
    .getMany();
}
*/

export { findPaginated, type PaginatedResult, type PaginationInput };
