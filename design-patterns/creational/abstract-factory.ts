/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                 ABSTRACT FACTORY PATTERN                     ║
 * ║                   (Creational Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Tạo families of related objects mà không cần chỉ rõ     │
 * │ concrete class. Đảm bảo các object tương thích nhau.    │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * IKEA bán bộ nội thất theo phong cách: Modern, Victorian, Art Deco.
 * Mỗi phong cách có ghế + bàn + tủ tương thích. Bạn chọn "phong cách"
 * chứ không chọn từng món rời → đảm bảo đồng bộ.
 *
 * 🔑 KHÁC VỚI FACTORY METHOD:
 *   Factory Method   → tạo 1 loại product
 *   Abstract Factory → tạo FAMILY of products (nhiều loại liên quan)
 *
 * 📐 CLASS DIAGRAM:
 *
 *               ┌─────────────────┐
 *               │ «interface»     │
 *               │ DatabaseFactory │
 *               ├─────────────────┤
 *               │+createConnection│
 *               │+createQuery     │
 *               │+createMigration │
 *               └────────┬────────┘
 *                    implements
 *            ┌──────────┼──────────┐
 *            ▼          ▼          ▼
 *     ┌──────────┐┌──────────┐┌──────────┐
 *     │ PostgreSQL││  MySQL   ││  SQLite  │
 *     │ Factory  ││ Factory  ││ Factory  │
 *     └──────────┘└──────────┘└──────────┘
 *         │            │            │
 *    tạo ra:       tạo ra:      tạo ra:
 *  PgConnection  MysqlConn    SqliteConn
 *  PgQuery       MysqlQuery   SqliteQuery
 *  PgMigration   MysqlMigr    SqliteMigr
 */

// ============================================================
// ABSTRACT PRODUCTS
// ============================================================

interface DatabaseConnection {
  readonly engine: string;
  connect(connectionString: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

interface QueryBuilder {
  readonly engine: string;
  select(table: string, columns: string[]): string;
  insert(table: string, data: Record<string, unknown>): string;
  where(condition: string): string;
}

interface MigrationRunner {
  readonly engine: string;
  createTable(name: string, columns: Record<string, string>): string;
  addIndex(table: string, columns: string[]): string;
}

// ============================================================
// CONCRETE PRODUCTS: PostgreSQL
// ============================================================

class PgConnection implements DatabaseConnection {
  readonly engine = "PostgreSQL";
  private connected = false;

  async connect(cs: string): Promise<void> {
    console.log(`  🐘 [PG] Connecting to ${cs}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`  🐘 [PG] Disconnected`);
  }

  isConnected(): boolean { return this.connected; }
}

class PgQueryBuilder implements QueryBuilder {
  readonly engine = "PostgreSQL";

  select(table: string, columns: string[]): string {
    return `SELECT ${columns.join(", ")} FROM "${table}"`;  // PG dùng double quotes
  }

  insert(table: string, data: Record<string, unknown>): string {
    const cols = Object.keys(data).map((c) => `"${c}"`).join(", ");
    const vals = Object.values(data).map((v) => `'${v}'`).join(", ");
    return `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`;  // PG có RETURNING
  }

  where(condition: string): string {
    return `WHERE ${condition}`;
  }
}

class PgMigrationRunner implements MigrationRunner {
  readonly engine = "PostgreSQL";

  createTable(name: string, columns: Record<string, string>): string {
    const cols = Object.entries(columns).map(([n, t]) => `  "${n}" ${t}`).join(",\n");
    return `CREATE TABLE IF NOT EXISTS "${name}" (\n${cols}\n);`;
  }

  addIndex(table: string, columns: string[]): string {
    const indexName = `idx_${table}_${columns.join("_")}`;
    return `CREATE INDEX CONCURRENTLY "${indexName}" ON "${table}" (${columns.join(", ")});`;
  }
}

// ============================================================
// CONCRETE PRODUCTS: MySQL
// ============================================================

class MysqlConnection implements DatabaseConnection {
  readonly engine = "MySQL";
  private connected = false;

  async connect(cs: string): Promise<void> {
    console.log(`  🐬 [MySQL] Connecting to ${cs}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log(`  🐬 [MySQL] Disconnected`);
  }

  isConnected(): boolean { return this.connected; }
}

class MysqlQueryBuilder implements QueryBuilder {
  readonly engine = "MySQL";

  select(table: string, columns: string[]): string {
    return `SELECT ${columns.join(", ")} FROM \`${table}\``;  // MySQL dùng backticks
  }

  insert(table: string, data: Record<string, unknown>): string {
    const cols = Object.keys(data).map((c) => `\`${c}\``).join(", ");
    const vals = Object.values(data).map((v) => `'${v}'`).join(", ");
    return `INSERT INTO \`${table}\` (${cols}) VALUES (${vals})`;
  }

  where(condition: string): string {
    return `WHERE ${condition}`;
  }
}

class MysqlMigrationRunner implements MigrationRunner {
  readonly engine = "MySQL";

  createTable(name: string, columns: Record<string, string>): string {
    const cols = Object.entries(columns).map(([n, t]) => `  \`${n}\` ${t}`).join(",\n");
    return `CREATE TABLE IF NOT EXISTS \`${name}\` (\n${cols}\n) ENGINE=InnoDB;`;
  }

  addIndex(table: string, columns: string[]): string {
    const indexName = `idx_${table}_${columns.join("_")}`;
    return `ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns.join(", ")});`;
  }
}

// ============================================================
// ABSTRACT FACTORY
// ============================================================

interface DatabaseFactory {
  readonly name: string;
  createConnection(): DatabaseConnection;
  createQueryBuilder(): QueryBuilder;
  createMigrationRunner(): MigrationRunner;
}

// ============================================================
// CONCRETE FACTORIES
// ============================================================

class PostgreSQLFactory implements DatabaseFactory {
  readonly name = "PostgreSQL";
  createConnection(): DatabaseConnection { return new PgConnection(); }
  createQueryBuilder(): QueryBuilder { return new PgQueryBuilder(); }
  createMigrationRunner(): MigrationRunner { return new PgMigrationRunner(); }
}

class MySQLFactory implements DatabaseFactory {
  readonly name = "MySQL";
  createConnection(): DatabaseConnection { return new MysqlConnection(); }
  createQueryBuilder(): QueryBuilder { return new MysqlQueryBuilder(); }
  createMigrationRunner(): MigrationRunner { return new MysqlMigrationRunner(); }
}

// ============================================================
// CLIENT CODE → chỉ dùng interface, không biết concrete class
// ============================================================

async function setupDatabase(factory: DatabaseFactory) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`🏭 Using ${factory.name} Factory`);
  console.log(`${"═".repeat(50)}`);

  // Tất cả products đều tương thích vì cùng 1 factory
  const connection = factory.createConnection();
  const queryBuilder = factory.createQueryBuilder();
  const migration = factory.createMigrationRunner();

  await connection.connect(`${factory.name.toLowerCase()}://localhost/mydb`);

  // Migration
  console.log("\n📋 Migration:");
  console.log(migration.createTable("users", {
    id: "SERIAL PRIMARY KEY",
    name: "VARCHAR(100) NOT NULL",
    email: "VARCHAR(255) UNIQUE",
  }));
  console.log(migration.addIndex("users", ["email"]));

  // Queries
  console.log("\n📊 Queries:");
  console.log(queryBuilder.select("users", ["id", "name", "email"]));
  console.log(queryBuilder.insert("users", { name: "Alice", email: "alice@test.com" }));

  await connection.disconnect();
}

// ============================================================
// USAGE
// ============================================================

async function demo() {
  // Đổi database engine = chỉ đổi factory, KHÔNG sửa business logic
  await setupDatabase(new PostgreSQLFactory());
  await setupDatabase(new MySQLFactory());

  // Factory from config
  const DB_TYPE = "postgresql";
  const factory = createFactoryFromConfig(DB_TYPE);
  console.log(`\n🔧 Config-based: ${factory.name}`);
}

/** Helper: tạo factory từ config string */
function createFactoryFromConfig(dbType: string): DatabaseFactory {
  const factories: Record<string, () => DatabaseFactory> = {
    postgresql: () => new PostgreSQLFactory(),
    mysql: () => new MySQLFactory(),
  };

  const creator = factories[dbType.toLowerCase()];
  if (!creator) throw new Error(`Unsupported DB: ${dbType}`);
  return creator();
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Abstract Factory tạo FAMILY of objects (Connection + Query + Migration)
 * 2. Đảm bảo tương thích: PgConnection + PgQuery luôn đi cùng nhau
 * 3. Đổi DB engine = đổi 1 dòng (factory), không sửa business logic
 * 4. Tuân thủ OCP: thêm SQLite = thêm factory + products mới
 * 5. NestJS: TypeORM/Prisma đã áp dụng pattern này internally
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ CROSS-PLATFORM UI KIT
 *    Bài toán: App cần render UI cho Web, iOS, Android. Mỗi platform có
 *    Button, Input, Modal khác nhau. Nếu dùng if/else → spaghetti code.
 *    Giải pháp: UIFactory → WebFactory | iOSFactory | AndroidFactory
 *    Mỗi factory tạo ra family: Button + Input + Modal tương thích nhau.
 *    → WebFactory.createButton() trả về <button>, iOSFactory → UIButton
 *    ❌ KHÔNG BAO GIỜ trộn WebButton + iOSModal (factory đảm bảo consistency)
 *
 * 2️⃣ DATABASE TOOLKIT (ví dụ trên)
 *    Bài toán: App hỗ trợ PostgreSQL, MySQL, SQLite. Mỗi DB cần
 *    Connection + QueryBuilder + MigrationRunner riêng (cú pháp SQL khác).
 *    Giải pháp: DatabaseFactory tạo ra family 3 products tương thích.
 *    Thực tế: TypeORM nội bộ dùng chính pattern này:
 *    - PostgresDriver + PostgresQueryRunner + PostgresSchemaBuilder
 *    - MysqlDriver + MysqlQueryRunner + MysqlSchemaBuilder
 *
 * 3️⃣ CLOUD PROVIDER SDK
 *    Bài toán: SaaS app deploy trên AWS hoặc GCP. Cần Storage + Queue + Cache
 *    tương thích nhau (AWS S3 + SQS + ElastiCache vs GCS + Pub/Sub + Memorystore).
 *    Giải pháp: CloudFactory.create("aws") → { storage: S3, queue: SQS, cache: ElastiCache }
 *    Đổi cloud = đổi 1 dòng config, toàn bộ infrastructure tự động thay đổi.
 *    → Tránh lỗi trộn S3 (AWS) với Pub/Sub (GCP) — incompatible regions.
 *
 * 4️⃣ THEME SYSTEM (Design System)
 *    Bài toán: App có Light theme và Dark theme. Mỗi theme cần bộ
 *    Colors + Typography + Shadows + Borders đồng bộ nhau.
 *    Giải pháp: ThemeFactory → LightThemeFactory | DarkThemeFactory
 *    Mỗi factory tạo ra: colors + fonts + shadows TƯƠNG THÍCH.
 *    ❌ KHÔNG DÙNG: Dark text color + Dark background = unreadable
 *    ✅ Factory đảm bảo: Dark text + Light bg HOẶC Light text + Dark bg
 *
 * 5️⃣ PAYMENT ECOSYSTEM
 *    Bài toán: Mỗi payment provider (Stripe, PayPal) cần bộ:
 *    ChargeService + RefundService + WebhookHandler phải cùng provider.
 *    Giải pháp: PaymentFactory → StripeFactory | PayPalFactory
 *    → StripeFactory tạo: { charge: StripeCharge, refund: StripeRefund, webhook: StripeWebhook }
 *    ❌ Không thể dùng StripeCharge + PayPalRefund (transaction ID không khớp)
 *
 * 📌 KHÁC VỚI FACTORY METHOD:
 *    Factory Method: tạo 1 product (Logger)
 *    Abstract Factory: tạo FAMILY products phải ĐI CÙNG NHAU
 *    → Dùng Abstract Factory khi các products có dependency lẫn nhau
 */

export { DatabaseFactory, PostgreSQLFactory, MySQLFactory };
