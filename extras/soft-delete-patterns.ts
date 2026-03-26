/**
 * ============================================
 * SOFT DELETE PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Soft delete — đánh dấu deletedAt thay vì xóa thật
 * 2. Global query filter — tự động exclude deleted records
 * 3. Restore — khôi phục records đã xóa
 * 4. Cascade soft delete — xóa liên quan
 * 5. Hard delete — scheduled cleanup sau N ngày
 * 6. Unique constraints với soft delete
 */

// ═══════════════════════════════════════════
// Rule 1: Soft Delete Entity
// ═══════════════════════════════════════════

// ❌ BAD: Hard delete — mất data vĩnh viễn
/*
async remove(id: string): Promise<void> {
  await this.userRepo.delete(id); // Xóa thật → không khôi phục được!
}
*/

// ✅ GOOD: Soft delete — giữ lại data
interface SoftDeletable {
  deletedAt: Date | null;
  deletedBy: string | null;
}

// ✅ GOOD: Base entity với soft delete
const baseEntityExample = `
// base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()     // TypeORM soft delete support
  deletedAt: Date | null;

  @Column({ nullable: true })
  deletedBy: string | null;
}

// user.entity.ts
@Entity('users')
export class UserEntity extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;
}
`;

// ═══════════════════════════════════════════
// Rule 2: Repository Pattern
// ═══════════════════════════════════════════

// ✅ GOOD: Service methods cho soft delete
class SoftDeleteService<T extends SoftDeletable & { id: string }> {
  constructor(private readonly items: T[]) {}

  // Soft delete
  async softDelete(id: string, deletedBy: string): Promise<T | null> {
    const item = this.items.find(i => i.id === id && !i.deletedAt);
    if (!item) return null;

    item.deletedAt = new Date();
    item.deletedBy = deletedBy;
    return item;
  }

  // Restore
  async restore(id: string): Promise<T | null> {
    const item = this.items.find(i => i.id === id && i.deletedAt !== null);
    if (!item) return null;

    item.deletedAt = null;
    item.deletedBy = null;
    return item;
  }

  // Find (exclude deleted by default)
  findAll(includeDeleted = false): T[] {
    if (includeDeleted) return this.items;
    return this.items.filter(i => !i.deletedAt);
  }

  // Find only deleted (for admin/recovery)
  findDeleted(): T[] {
    return this.items.filter(i => i.deletedAt !== null);
  }

  // Hard delete (permanent)
  hardDelete(id: string): boolean {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
}

// ═══════════════════════════════════════════
// Rule 3: TypeORM Soft Delete
// ═══════════════════════════════════════════

// ✅ GOOD: TypeORM built-in soft delete
const typeormExample = `
// TypeORM automatically filters soft-deleted records

// Soft delete
await this.userRepo.softDelete(id);
// SQL: UPDATE users SET deleted_at = NOW() WHERE id = :id

// Soft delete with who deleted
await this.userRepo.update(id, { deletedBy: currentUserId });
await this.userRepo.softDelete(id);

// Restore
await this.userRepo.restore(id);
// SQL: UPDATE users SET deleted_at = NULL WHERE id = :id

// Find (auto-excludes soft deleted)
await this.userRepo.find();
// SQL: SELECT * FROM users WHERE deleted_at IS NULL

// Find including soft deleted
await this.userRepo.find({ withDeleted: true });
// SQL: SELECT * FROM users

// Find only soft deleted
await this.userRepo.find({
  withDeleted: true,
  where: { deletedAt: Not(IsNull()) },
});

// Count (excludes deleted)
await this.userRepo.count();
// SQL: SELECT COUNT(*) FROM users WHERE deleted_at IS NULL
`;

// ═══════════════════════════════════════════
// Rule 4: Unique Constraints + Soft Delete
// ═══════════════════════════════════════════

// ❌ BAD: Unique constraint blocks re-registration
// User deletes account → email soft deleted
// User tries to register again with same email → UNIQUE violation!

// ✅ GOOD: Partial unique index (PostgreSQL)
const uniqueConstraintSql = `
-- Instead of: UNIQUE (email)
-- Use partial unique index:
CREATE UNIQUE INDEX idx_users_email_active
  ON users (email)
  WHERE deleted_at IS NULL;

-- Deleted users don't count toward uniqueness
-- User can re-register with same email after soft delete
`;

// ═══════════════════════════════════════════
// Rule 5: Cascading Soft Delete
// ═══════════════════════════════════════════

// ✅ GOOD: Soft delete related entities
const cascadeExample = `
@Injectable()
export class UserService {
  async softDeleteUser(userId: string, deletedBy: string): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const now = new Date();

      // Soft delete user
      await manager.update(UserEntity, userId, {
        deletedAt: now,
        deletedBy,
      });

      // Cascade: soft delete user's orders
      await manager.update(OrderEntity,
        { userId, deletedAt: IsNull() },
        { deletedAt: now, deletedBy },
      );

      // Cascade: soft delete user's reviews
      await manager.update(ReviewEntity,
        { userId, deletedAt: IsNull() },
        { deletedAt: now, deletedBy },
      );

      // Don't cascade: keep payment records (legal requirement)
    });
  }

  async restoreUser(userId: string): Promise<void> {
    await this.dataSource.transaction(async manager => {
      // Restore user
      await manager.update(UserEntity, userId, {
        deletedAt: null,
        deletedBy: null,
      });

      // Restore related entities
      await manager.update(OrderEntity,
        { userId, deletedBy: userId },
        { deletedAt: null, deletedBy: null },
      );
    });
  }
}
`;

// ═══════════════════════════════════════════
// Rule 6: Scheduled Hard Delete (Cleanup)
// ═══════════════════════════════════════════

// ✅ GOOD: Clean up old soft-deleted records
const cleanupExample = `
@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger(DataCleanupService.name);

  // Run daily at 2 AM
  @Cron('0 2 * * *')
  async cleanupDeletedRecords(): Promise<void> {
    const retentionDays = 90; // Keep deleted records for 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Hard delete records soft-deleted more than 90 days ago
    const result = await this.userRepo
      .createQueryBuilder()
      .delete()
      .where('deleted_at IS NOT NULL')
      .andWhere('deleted_at < :cutoff', { cutoff: cutoffDate })
      .execute();

    this.logger.log(
      \`Cleaned up \${result.affected} records older than \${retentionDays} days\`,
    );
  }
}
`;

// ═══════════════════════════════════════════
// Rule 7: Best Practices
// ═══════════════════════════════════════════

const SOFT_DELETE_BEST_PRACTICES = {
  always: [
    'Dùng @DeleteDateColumn() của TypeORM',
    'Lưu deletedBy — ai đã xóa',
    'Partial unique index cho unique fields',
    'API endpoint riêng cho restore (PATCH /users/:id/restore)',
    'Scheduled cleanup cho hard delete sau N ngày',
  ],
  avoid: [
    'Hard delete data có liên quan đến finance/legal',
    'Quên filter deleted records trong queries',
    'Cascade soft delete quá rộng — có thể mất data cần giữ',
    'Soft delete mà không có cleanup → database phình to',
  ],
  useHardDelete: [
    'Temporary/cache data',
    'Session tokens',
    'OTP codes',
    'Logs (rotate instead)',
  ],
};

export {
  SoftDeleteService,
  typeormExample,
  baseEntityExample,
  uniqueConstraintSql,
  cascadeExample,
  cleanupExample,
  SOFT_DELETE_BEST_PRACTICES,
  type SoftDeletable,
};
