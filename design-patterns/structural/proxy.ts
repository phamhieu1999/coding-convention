/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                      PROXY PATTERN                           ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Đặt một object đại diện (surrogate) trước object thật
 * để kiểm soát truy cập: caching, auth, lazy loading, logging.
 *
 * 🏠 ANALOGY: Thư ký CEO. Muốn gặp CEO? Qua thư ký trước.
 * Thư ký kiểm tra lịch, xác minh danh tính, rồi mới cho gặp.
 *
 * 📐 TYPES OF PROXY:
 *  - Virtual Proxy:    Lazy loading (tạo real object khi cần)
 *  - Protection Proxy: Access control (kiểm tra quyền)
 *  - Caching Proxy:    Cache kết quả (tránh gọi lại)
 *  - Logging Proxy:    Log mọi access
 */

// ============================================================
// SERVICE INTERFACE
// ============================================================

interface UserData { id: number; name: string; email: string; role: string; }
interface UserService {
  getById(id: number): Promise<UserData | null>;
  getAll(): Promise<UserData[]>;
  create(data: Omit<UserData, "id">): Promise<UserData>;
  delete(id: number): Promise<boolean>;
}

// ============================================================
// REAL SERVICE
// ============================================================

class RealUserService implements UserService {
  private users: UserData[] = [
    { id: 1, name: "Alice", email: "alice@test.com", role: "admin" },
    { id: 2, name: "Bob", email: "bob@test.com", role: "user" },
    { id: 3, name: "Charlie", email: "charlie@test.com", role: "user" },
  ];
  private nextId = 4;

  async getById(id: number): Promise<UserData | null> {
    console.log(`    🔍 [DB] SELECT * FROM users WHERE id = ${id}`);
    return this.users.find((u) => u.id === id) ?? null;
  }
  async getAll(): Promise<UserData[]> {
    console.log("    🔍 [DB] SELECT * FROM users");
    return [...this.users];
  }
  async create(data: Omit<UserData, "id">): Promise<UserData> {
    const user = { id: this.nextId++, ...data };
    this.users.push(user);
    console.log(`    📝 [DB] INSERT user: ${user.name}`);
    return user;
  }
  async delete(id: number): Promise<boolean> {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    console.log(`    🗑️ [DB] DELETE user id=${id}`);
    return true;
  }
}

// ============================================================
// CACHING PROXY
// ============================================================

class CachingProxy implements UserService {
  private cache = new Map<string, { data: any; expiry: number }>();
  constructor(private readonly service: UserService, private readonly ttlMs = 5000) {}

  async getById(id: number): Promise<UserData | null> {
    const key = `user:${id}`;
    const cached = this.getCache(key);
    if (cached !== undefined) {
      console.log(`  💾 [Cache] HIT: ${key}`);
      return cached;
    }
    console.log(`  💾 [Cache] MISS: ${key}`);
    const result = await this.service.getById(id);
    this.setCache(key, result);
    return result;
  }

  async getAll(): Promise<UserData[]> {
    const cached = this.getCache("users:all");
    if (cached !== undefined) { console.log("  💾 [Cache] HIT: users:all"); return cached; }
    console.log("  💾 [Cache] MISS: users:all");
    const result = await this.service.getAll();
    this.setCache("users:all", result);
    return result;
  }

  async create(data: Omit<UserData, "id">): Promise<UserData> {
    this.invalidate(); // Write → clear cache
    return this.service.create(data);
  }

  async delete(id: number): Promise<boolean> {
    this.invalidate();
    return this.service.delete(id);
  }

  private getCache(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) return entry.data;
    this.cache.delete(key);
    return undefined;
  }

  private setCache(key: string, data: any): void { this.cache.set(key, { data, expiry: Date.now() + this.ttlMs }); }
  private invalidate(): void { this.cache.clear(); console.log("  💾 [Cache] Invalidated all"); }
}

// ============================================================
// ACCESS CONTROL PROXY
// ============================================================

interface Caller { userId: number; role: "admin" | "user" | "guest"; }

class AccessControlProxy implements UserService {
  constructor(private readonly service: UserService, private readonly caller: Caller) {}

  async getById(id: number): Promise<UserData | null> {
    // Guests không thể xem user khác
    if (this.caller.role === "guest") throw new Error("❌ Guests cannot access user data");
    console.log(`  🔐 [Auth] ${this.caller.role} accessing user ${id} ✅`);
    return this.service.getById(id);
  }

  async getAll(): Promise<UserData[]> {
    if (this.caller.role === "guest") throw new Error("❌ Guests cannot list users");
    console.log(`  🔐 [Auth] ${this.caller.role} listing users ✅`);
    return this.service.getAll();
  }

  async create(data: Omit<UserData, "id">): Promise<UserData> {
    if (this.caller.role !== "admin") throw new Error("❌ Only admins can create users");
    console.log(`  🔐 [Auth] admin creating user ✅`);
    return this.service.create(data);
  }

  async delete(id: number): Promise<boolean> {
    if (this.caller.role !== "admin") throw new Error("❌ Only admins can delete users");
    console.log(`  🔐 [Auth] admin deleting user ${id} ✅`);
    return this.service.delete(id);
  }
}

// ============================================================
// LOGGING PROXY
// ============================================================

class LoggingProxy implements UserService {
  constructor(private readonly service: UserService) {}

  async getById(id: number): Promise<UserData | null> {
    const start = Date.now();
    const result = await this.service.getById(id);
    console.log(`  📝 [Log] getById(${id}) → ${result ? "found" : "null"} (${Date.now() - start}ms)`);
    return result;
  }

  async getAll(): Promise<UserData[]> {
    const start = Date.now();
    const result = await this.service.getAll();
    console.log(`  📝 [Log] getAll() → ${result.length} users (${Date.now() - start}ms)`);
    return result;
  }

  async create(data: Omit<UserData, "id">): Promise<UserData> {
    const result = await this.service.create(data);
    console.log(`  📝 [Log] create(${data.name}) → id=${result.id}`);
    return result;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.service.delete(id);
    console.log(`  📝 [Log] delete(${id}) → ${result}`);
    return result;
  }
}

// ============================================================
// USAGE: Stack proxies
// ============================================================

async function demo() {
  const realService = new RealUserService();

  // Stack: Logging → AccessControl → Caching → RealService
  const proxied: UserService = new LoggingProxy(
    new AccessControlProxy(
      new CachingProxy(realService, 3000),
      { userId: 1, role: "admin" }
    )
  );

  console.log("=== Get user (cache MISS) ===");
  await proxied.getById(1);

  console.log("\n=== Get user (cache HIT) ===");
  await proxied.getById(1);

  console.log("\n=== Create user (invalidates cache) ===");
  await proxied.create({ name: "Dave", email: "dave@test.com", role: "user" });

  console.log("\n=== Access denied (user role) ===");
  const userProxy = new AccessControlProxy(realService, { userId: 2, role: "user" });
  try { await userProxy.delete(1); } catch (e: any) { console.log(`  ${e.message}`); }
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Proxy = SAME interface as real object → transparent cho client
 * 2. Stack proxies: Log → Auth → Cache → Real (giống Decorator)
 * 3. Khác Decorator: Proxy kiểm soát ACCESS, Decorator thêm BEHAVIOR
 * 4. NestJS: Guards (auth proxy), Interceptors (logging/caching proxy)
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ CACHING PROXY (ví dụ trên)
 *    Bài toán: API endpoint getUser(id) gọi DB mỗi lần → chậm, tốn resource.
 *    1000 req/s cho cùng user → 1000 DB queries → database choking.
 *    Giải pháp: CachingProxy check Redis/memory trước, chỉ gọi DB khi miss.
 *    Thực tế: NestJS CacheInterceptor, Redis proxy, CDN (Cloudflare = proxy pattern).
 *    Kết quả: 1000 req/s → 1 DB query + 999 cache hits → response 1ms thay vì 50ms.
 *
 * 2️⃣ ACCESS CONTROL PROXY (Authorization)
 *    Bài toán: UserService có create(), delete() — chỉ admin được dùng.
 *    Nếu check role trong mỗi method → lặp code, dễ quên.
 *    Giải pháp: AccessControlProxy check role TRƯỚC khi delegate xuống real service.
 *    Thực tế: NestJS Guards = Access Control Proxy pattern.
 *    @UseGuards(RolesGuard) trên controller method = proxy check quyền.
 *
 * 3️⃣ LAZY LOADING PROXY (Virtual Proxy)
 *    Bài toán: Load user có 50 orders → mỗi order có 10 items → 500 items.
 *    Nếu load hết lúc query user → chậm, tốn memory.
 *    Giải pháp: LazyProxy trả về accessor — chỉ query orders khi access user.orders.
 *    Thực tế: TypeORM lazy relations: @OneToMany(() => Order, { lazy: true })
 *    user.orders → Promise → query lần đầu, cache cho lần sau.
 *
 * 4️⃣ CIRCUIT BREAKER PROXY
 *    Bài toán: Downstream service (payment API) bị chết. Mỗi request timeout 30s
 *    → 1000 requests pending → app cũng chết theo (cascading failure).
 *    Giải pháp: CircuitBreakerProxy theo dõi failure rate.
 *    - CLOSED (bình thường): forward requests → real service
 *    - OPEN (>50% fail trong 10s): reject ngay, KHÔNG gọi real service → fail fast
 *    - HALF-OPEN (sau 30s): thử 1 request, nếu OK → CLOSED, fail → OPEN
 *    Thực tế: opossum, cockatiel packages, Istio service mesh.
 *
 * 5️⃣ LOGGING / METRICS PROXY
 *    Bài toán: Cần log mọi DB query: thời gian, result count, errors.
 *    Không muốn sửa Repository code (SRP violation).
 *    Giải pháp: LoggingProxy wrap Repository → log trước/sau mỗi method call.
 *    Code: const repo = new LoggingProxy(new UserRepository());
 *          repo.findAll(); // → "[Log] findAll() → 42 results (23ms)"
 *    Thực tế: TypeORM logger option, Prisma middlewares, Mongoose plugins.
 *
 * 📌 PROXY vs DECORATOR:
 *    Proxy: KIỂM SOÁT access (auth, cache, lazy-load, circuit-breaker)
 *           → Proxy thường TẠO hoặc QUẢN LÝ real object
 *    Decorator: THÊM behavior (logging, retry, rate-limit)
 *              → Decorator NHẬN real object qua constructor
 *    Trong thực tế, ranh giới mờ — CachingProxy ≈ CachingDecorator.
 *    Khác biệt chính: intent (kiểm soát vs mở rộng), không phải structure.
 */

export { UserService, CachingProxy, AccessControlProxy, LoggingProxy };
