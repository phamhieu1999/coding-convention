/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    SINGLETON PATTERN                         ║
 * ║                    (Creational Pattern)                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Đảm bảo một class chỉ có DUY NHẤT MỘT instance và     │
 * │ cung cấp một điểm truy cập toàn cục đến instance đó.   │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Một quốc gia chỉ có 1 tổng thống. Bất kỳ ai hỏi "Tổng thống là ai?"
 * đều nhận được cùng 1 câu trả lời. Không thể tạo thêm tổng thống thứ 2.
 *
 * ✅ KHI NÀO DÙNG:
 *   - Database connection pool
 *   - Logger, Configuration manager
 *   - Cache manager, Thread pool
 *   - Hardware interface (printer spooler)
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Khi cần nhiều instance (user objects, orders)
 *   - Khi cần dependency injection (test khó)
 *   - Khi state thay đổi liên tục giữa các context
 *
 * 📐 CLASS DIAGRAM:
 * ┌──────────────────────────────────┐
 * │        DatabaseConnection        │
 * ├──────────────────────────────────┤
 * │ - static instance: DatabaseConn  │
 * │ - host: string                   │
 * │ - port: number                   │
 * │ - isConnected: boolean           │
 * ├──────────────────────────────────┤
 * │ - constructor()          // private│
 * │ + static getInstance(): DatabaseConn│
 * │ + connect(): Promise<void>       │
 * │ + disconnect(): void             │
 * │ + query<T>(sql): Promise<T>      │
 * └──────────────────────────────────┘
 */

// ============================================================
// IMPLEMENTATION
// ============================================================

interface ConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly maxRetries: number;
}

class DatabaseConnection {
  // Static instance - chia sẻ giữa toàn bộ app
  private static instance: DatabaseConnection | null = null;

  private isConnected: boolean = false;
  private queryCount: number = 0;
  private readonly config: ConnectionConfig;

  // ⚠️ PRIVATE constructor → ngăn `new DatabaseConnection()`
  private constructor(config: ConnectionConfig) {
    this.config = Object.freeze(config); // Immutable config
  }

  /**
   * Thread-safe getInstance (trong single-thread JS đã safe)
   * Lazy initialization: chỉ tạo khi gọi lần đầu
   */
  static getInstance(config?: Partial<ConnectionConfig>): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection({
        host: config?.host ?? "localhost",
        port: config?.port ?? 5432,
        database: config?.database ?? "mydb",
        maxRetries: config?.maxRetries ?? 3,
      });
    }
    return DatabaseConnection.instance;
  }

  /** Reset instance (chỉ dùng trong testing) */
  static resetInstance(): void {
    DatabaseConnection.instance?.disconnect();
    DatabaseConnection.instance = null;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log("⚠️  Already connected, reusing connection.");
      return;
    }

    const { host, port, database, maxRetries } = this.config;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔌 Connecting to ${host}:${port}/${database} (attempt ${attempt})...`);
        await this.simulateDelay(100);
        this.isConnected = true;
        console.log("✅ Connected successfully!");
        return;
      } catch {
        if (attempt === maxRetries) throw new Error("Connection failed after retries");
      }
    }
  }

  async query<T = unknown>(sql: string): Promise<T> {
    if (!this.isConnected) {
      throw new Error("❌ Not connected! Call connect() first.");
    }
    this.queryCount++;
    console.log(`📊 [Query #${this.queryCount}] ${sql}`);
    await this.simulateDelay(10);
    return { result: "mock data", sql } as T;
  }

  disconnect(): void {
    if (this.isConnected) {
      console.log(`🔌 Disconnected. Total queries: ${this.queryCount}`);
      this.isConnected = false;
    }
  }

  getStats(): { connected: boolean; queries: number; config: ConnectionConfig } {
    return { connected: this.isConnected, queries: this.queryCount, config: this.config };
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// USAGE
// ============================================================

async function demo() {
  // Lấy instance từ bất kỳ đâu → luôn cùng 1 object
  const db1 = DatabaseConnection.getInstance({ host: "prod-server", port: 5432 });
  const db2 = DatabaseConnection.getInstance(); // config bị bỏ qua → dùng instance cũ

  console.log("Same instance?", db1 === db2); // ✅ true

  await db1.connect();
  await db2.query("SELECT * FROM users");      // db2 cũng connected!
  await db1.query("SELECT * FROM orders");

  console.log("\n📈 Stats:", db1.getStats());
  db1.disconnect();
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Private constructor + static getInstance() = chỉ 1 instance
 * 2. Lazy initialization: tạo khi cần, không tạo trước
 * 3. Config immutable (Object.freeze) → tránh side effects
 * 4. resetInstance() cho testing → tránh test pollution
 * 5. Trong NestJS: dùng @Injectable() với default scope SINGLETON
 *    → framework tự xử lý, không cần tự implement
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ DATABASE CONNECTION POOL (ví dụ trên)
 *    Bài toán: App có 100 modules đều cần truy vấn DB. Nếu mỗi module
 *    tự tạo connection → 100 connections → DB crash (max_connections).
 *    Giải pháp: Singleton giữ 1 pool duy nhất, chia sẻ cho tất cả modules.
 *    Thực tế: TypeORM DataSource, Prisma Client, Mongoose connection.
 *
 * 2️⃣ CONFIGURATION MANAGER
 *    Bài toán: Đọc config từ .env, YAML, remote (Consul, AWS SSM).
 *    Nếu mỗi service tự đọc → không đồng bộ, tốn I/O, khó invalidate cache.
 *    Giải pháp: ConfigService singleton load 1 lần lúc boot, cache trong memory.
 *    Thực tế: NestJS ConfigModule, dotenv, node-config package.
 *
 * 3️⃣ LOGGER
 *    Bài toán: Log cần ghi vào file/cloud nhất quán. Nếu mỗi module tạo
 *    logger riêng → file bị lock, log trùng, lost context (request ID).
 *    Giải pháp: Logger singleton giữ chung output stream, buffer, format.
 *    Thực tế: Winston, Pino, Bunyan — đều recommend dùng 1 instance.
 *
 * 4️⃣ CACHE MANAGER (Redis Client)
 *    Bài toán: 50 services đều cần cache. Mỗi service tạo Redis client
 *    → 50 TCP connections → tốn resource, khó quản lý TTL.
 *    Giải pháp: 1 CacheManager singleton, expose get/set/del methods.
 *    Thực tế: ioredis, cache-manager package trong NestJS.
 *
 * 5️⃣ RATE LIMITER (In-Memory)
 *    Bài toán: Giới hạn 100 req/min cho mỗi IP. Nếu mỗi middleware instance
 *    có counter riêng → đếm sai (mỗi cái đếm 100 → thực tế 300 req lọt).
 *    Giải pháp: Singleton giữ 1 Map<IP, count> duy nhất, đếm chính xác.
 *    Thực tế: express-rate-limit, @nestjs/throttler.
 *
 * 6️⃣ FEATURE FLAGS MANAGER
 *    Bài toán: Feature flags (LaunchDarkly, Unleash) cần poll server mỗi 30s.
 *    Nếu mỗi module tạo client riêng → N polling intervals → tốn bandwidth.
 *    Giải pháp: 1 FeatureFlagService singleton, poll 1 lần, chia sẻ state.
 *    Thực tế: LaunchDarkly SDK, Unleash Client — đều là singleton.
 *
 * ⚠️ LƯU Ý QUAN TRỌNG:
 *    - Singleton = "global state ẩn" → khó test, khó mock
 *    - Trong NestJS, KHÔNG cần tự implement → dùng DI container (default SINGLETON scope)
 *    - Chỉ dùng khi THẬT SỰ cần shared state (connection, cache, config)
 *    - Nếu object stateless → KHÔNG cần singleton, dùng DI bình thường
 */

export { DatabaseConnection };
