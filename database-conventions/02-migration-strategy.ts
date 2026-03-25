/**
 * ============================================
 * DATABASE CONVENTION #2: MIGRATION STRATEGY
 * ============================================
 *
 * Nguyên tắc:
 * 1. Mỗi thay đổi schema = 1 migration file
 * 2. Migration phải reversible (có up + down)
 * 3. KHÔNG sửa migration đã chạy — tạo migration mới
 * 4. Zero-downtime migration cho production
 * 5. Data migration tách riêng khỏi schema migration
 * 6. Test migration trên staging trước production
 */

// ═══════════════════════════════════════════
// Rule 2.1: Migration File Convention
// ═══════════════════════════════════════════

// ❌ BAD: Tên file không rõ ràng
const BAD_MIGRATION_NAMES = {
  'migration1.ts':           'Không mô tả nội dung',
  'fix.ts':                  'Mơ hồ — fix gì?',
  'update-users.ts':         'Quá chung chung',
  'changes.ts':              'Không có timestamp',
};

// ✅ GOOD: Timestamp + mô tả rõ ràng
const GOOD_MIGRATION_NAMES = {
  '1705312200000-CreateUsersTable.ts':         'Tạo users table',
  '1705312300000-AddEmailIndexToUsers.ts':     'Thêm index',
  '1705312400000-CreateOrdersTable.ts':        'Tạo orders table',
  '1705312500000-AddPhoneColumnToUsers.ts':    'Thêm column',
  '1705312600000-RenameStatusToOrderStatus.ts': 'Rename column',
  '1705312700000-SeedDefaultRoles.ts':         'Data seeding',
};

// ═══════════════════════════════════════════
// Rule 2.2: Migration Structure
// ═══════════════════════════════════════════

// ❌ BAD: Không có down method
/*
export class CreateUsersTable1705312200000 {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TABLE users (...)`);
  }
  // Không có down() → không rollback được!
}
*/

// ✅ GOOD: Có cả up và down
/*
export class CreateUsersTable1705312200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'email', type: 'varchar', length: '255', isUnique: true },
          { name: 'password', type: 'varchar', length: '255' },
          { name: 'first_name', type: 'varchar', length: '100' },
          { name: 'last_name', type: 'varchar', length: '100' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'role', type: 'varchar', length: '20', default: "'user'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'deleted_at', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex('users', new TableIndex({
      name: 'idx_users_email',
      columnNames: ['email'],
    }));

    await queryRunner.createIndex('users', new TableIndex({
      name: 'idx_users_created_at',
      columnNames: ['created_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'idx_users_created_at');
    await queryRunner.dropIndex('users', 'idx_users_email');
    await queryRunner.dropTable('users');
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.3: Column Operations — Add / Rename / Drop
// ═══════════════════════════════════════════

// ✅ GOOD: Add column (safe)
/*
// AddPhoneToUsers
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.addColumn('users', new TableColumn({
    name: 'phone',
    type: 'varchar',
    length: '20',
    isNullable: true,  // PHẢI nullable khi thêm vào table có data
  }));
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.dropColumn('users', 'phone');
}
*/

// ═══════════════════════════════════════════
// Rule 2.4: Zero-Downtime Migration
// ═══════════════════════════════════════════

// ❌ BAD: Rename column trực tiếp → app crash vì column cũ không tồn tại
/*
// Step 1 (SINGLE migration — DANGEROUS)
ALTER TABLE users RENAME COLUMN name TO full_name;
// → App vẫn query "name" → crash!
*/

// ✅ GOOD: 3-step migration cho zero-downtime
const ZERO_DOWNTIME_RENAME = {
  'Step 1 — Add new column': `
    -- Migration: AddFullNameToUsers
    ALTER TABLE users ADD COLUMN full_name VARCHAR(200);
    UPDATE users SET full_name = name; -- Copy data
    -- Deploy app v2: read from full_name, write to BOTH name and full_name
  `,

  'Step 2 — Switch primary': `
    -- Migration: MakeFullNameNotNull
    ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
    -- Deploy app v3: read/write only full_name
  `,

  'Step 3 — Drop old column': `
    -- Migration: DropNameFromUsers (sau khi confirm app v3 stable)
    ALTER TABLE users DROP COLUMN name;
  `,
};

// ═══════════════════════════════════════════
// Rule 2.5: Data Migration vs Schema Migration
// ═══════════════════════════════════════════

// ❌ BAD: Trộn data migration với schema change
/*
// Một migration vừa sửa schema vừa migrate data → chậm, khó rollback
public async up(queryRunner: QueryRunner) {
  await queryRunner.addColumn('users', new TableColumn({ name: 'full_name' }));
  // Migrate 1 triệu records inline → lock table, timeout!
  await queryRunner.query(`UPDATE users SET full_name = first_name || ' ' || last_name`);
  await queryRunner.dropColumn('users', 'first_name');
  await queryRunner.dropColumn('users', 'last_name');
}
*/

// ✅ GOOD: Tách thành multiple migrations
const MIGRATION_PHASES = {
  'Phase 1 — Schema (fast, no data)': [
    '1705312200000-AddFullNameColumn.ts',
  ],
  'Phase 2 — Data migration (batch, background)': [
    '1705312300000-MigrateFullNameData.ts', // Batch 1000 rows at a time
  ],
  'Phase 3 — Cleanup (after verification)': [
    '1705312400000-DropFirstNameLastName.ts',
  ],
};

// ═══════════════════════════════════════════
// Rule 2.6: Migration Commands
// ═══════════════════════════════════════════

/*
# Generate migration từ entity changes
npx typeorm migration:generate -d src/data-source.ts src/migrations/UpdateUsers

# Create empty migration
npx typeorm migration:create src/migrations/SeedDefaultRoles

# Run pending migrations
npx typeorm migration:run -d src/data-source.ts

# Rollback last migration
npx typeorm migration:revert -d src/data-source.ts

# Show migration status
npx typeorm migration:show -d src/data-source.ts
*/

// ═══════════════════════════════════════════
// Rule 2.7: Migration Checklist
// ═══════════════════════════════════════════

/*
Before running migration in production:

✅ Check: migration có down() method?
✅ Check: đã test trên staging?
✅ Check: new column có nullable hoặc default?
✅ Check: có column rename? → dùng 3-step approach
✅ Check: có drop column? → đã remove from app code?
✅ Check: data migration → dùng batch, không lock table?
✅ Check: estimated time cho large tables?
✅ Check: backup database trước khi migrate?
*/

export {
  GOOD_MIGRATION_NAMES,
  ZERO_DOWNTIME_RENAME,
  MIGRATION_PHASES,
};
