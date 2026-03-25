/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    DECORATOR PATTERN                         ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Thêm behavior MỚI cho object ĐỘNG (runtime) bằng cách  │
 * │ bọc (wrap) trong decorator. Thay thế cho inheritance.   │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Gói quà: Bắt đầu với món quà (plain) → bọc giấy gói → thắt nơ
 * → dán sticker. Mỗi lớp bọc thêm feature mà không thay đổi món quà.
 *
 * 📐 STACKING:
 *
 *  ┌─────────────────────────────────────┐
 *  │ RateLimitDecorator                  │  ← outermost
 *  │ ┌─────────────────────────────────┐ │
 *  │ │ LoggingDecorator                │ │
 *  │ │ ┌─────────────────────────────┐ │ │
 *  │ │ │ CachingDecorator            │ │ │
 *  │ │ │ ┌─────────────────────────┐ │ │ │
 *  │ │ │ │ RealHttpClient          │ │ │ │  ← core
 *  │ │ │ └─────────────────────────┘ │ │ │
 *  │ │ └─────────────────────────────┘ │ │
 *  │ └─────────────────────────────────┘ │
 *  └─────────────────────────────────────┘
 *
 * ✅ KHI NÀO DÙNG:
 *   - Thêm responsibility lúc runtime, không phải compile time
 *   - Khi inheritance tạo quá nhiều subclass
 *   - Middleware pattern (NestJS interceptors = decorators!)
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Behavior cố định, không cần swap
 *   - Stack quá sâu → khó debug
 */

// ============================================================
// COMPONENT INTERFACE
// ============================================================

interface HttpResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
  duration?: number;
}

interface HttpClient {
  get(url: string): Promise<HttpResponse>;
  post(url: string, body: unknown): Promise<HttpResponse>;
}

// ============================================================
// CONCRETE COMPONENT (core)
// ============================================================

class RealHttpClient implements HttpClient {
  async get(url: string): Promise<HttpResponse> {
    const start = Date.now();
    console.log(`    🌐 [HTTP] GET ${url}`);
    await this.delay(50); // Simulate network
    return { status: 200, data: { url, mock: true }, headers: {}, duration: Date.now() - start };
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    const start = Date.now();
    console.log(`    🌐 [HTTP] POST ${url}`);
    await this.delay(50);
    return { status: 201, data: { id: Date.now(), ...body as object }, headers: {}, duration: Date.now() - start };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ============================================================
// BASE DECORATOR
// ============================================================

abstract class HttpClientDecorator implements HttpClient {
  constructor(protected readonly wrapped: HttpClient) {}

  async get(url: string): Promise<HttpResponse> {
    return this.wrapped.get(url);
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    return this.wrapped.post(url, body);
  }
}

// ============================================================
// CONCRETE DECORATORS
// ============================================================

/** 📝 Logging Decorator: log request/response */
class LoggingDecorator extends HttpClientDecorator {
  async get(url: string): Promise<HttpResponse> {
    console.log(`  📝 [Log] → GET ${url}`);
    const start = Date.now();
    const response = await super.get(url);
    console.log(`  📝 [Log] ← ${response.status} (${Date.now() - start}ms)`);
    return response;
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    console.log(`  📝 [Log] → POST ${url} | Body: ${JSON.stringify(body)}`);
    const start = Date.now();
    const response = await super.post(url, body);
    console.log(`  📝 [Log] ← ${response.status} (${Date.now() - start}ms)`);
    return response;
  }
}

/** 💾 Caching Decorator: cache GET responses */
class CachingDecorator extends HttpClientDecorator {
  private readonly cache = new Map<string, { data: HttpResponse; expiry: number }>();

  constructor(wrapped: HttpClient, private readonly ttlMs: number = 30000) {
    super(wrapped);
  }

  async get(url: string): Promise<HttpResponse> {
    const cached = this.cache.get(url);
    if (cached && Date.now() < cached.expiry) {
      console.log(`  💾 [Cache] HIT: ${url}`);
      return { ...cached.data, headers: { ...cached.data.headers, "x-cache": "HIT" } };
    }

    console.log(`  💾 [Cache] MISS: ${url}`);
    const response = await super.get(url);
    this.cache.set(url, { data: response, expiry: Date.now() + this.ttlMs });
    return { ...response, headers: { ...response.headers, "x-cache": "MISS" } };
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    // POST invalidates cache
    this.cache.clear();
    console.log(`  💾 [Cache] Invalidated (POST request)`);
    return super.post(url, body);
  }
}

/** 🔄 Retry Decorator: retry on failure */
class RetryDecorator extends HttpClientDecorator {
  constructor(
    wrapped: HttpClient,
    private readonly maxRetries: number = 3,
    private readonly delayMs: number = 100
  ) {
    super(wrapped);
  }

  async get(url: string): Promise<HttpResponse> {
    return this.withRetry(() => super.get(url), "GET", url);
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    return this.withRetry(() => super.post(url, body), "POST", url);
  }

  private async withRetry(fn: () => Promise<HttpResponse>, method: string, url: string): Promise<HttpResponse> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`  🔄 [Retry] ${method} ${url} failed (attempt ${attempt}/${this.maxRetries})`);
        if (attempt === this.maxRetries) throw error;
        await new Promise((r) => setTimeout(r, this.delayMs * attempt)); // Exponential backoff
      }
    }
    throw new Error("Unreachable");
  }
}

/** ⏱️ Rate Limit Decorator */
class RateLimitDecorator extends HttpClientDecorator {
  private requestTimestamps: number[] = [];

  constructor(
    wrapped: HttpClient,
    private readonly maxRequests: number = 10,
    private readonly windowMs: number = 1000
  ) {
    super(wrapped);
  }

  async get(url: string): Promise<HttpResponse> {
    this.checkLimit();
    return super.get(url);
  }

  async post(url: string, body: unknown): Promise<HttpResponse> {
    this.checkLimit();
    return super.post(url, body);
  }

  private checkLimit(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < this.windowMs);
    if (this.requestTimestamps.length >= this.maxRequests) {
      throw new Error(`⏱️ Rate limit exceeded: ${this.maxRequests} req/${this.windowMs}ms`);
    }
    this.requestTimestamps.push(now);
    console.log(`  ⏱️ [RateLimit] ${this.requestTimestamps.length}/${this.maxRequests} requests`);
  }
}

// ============================================================
// USAGE
// ============================================================

async function demo() {
  // 🔑 Stack decorators like middleware
  // Order matters: outer decorator runs first

  console.log("=== Plain Client ===");
  const plain = new RealHttpClient();
  await plain.get("/api/users");

  console.log("\n=== Decorated Client: RateLimit → Logging → Cache → Retry → HTTP ===");
  const decorated: HttpClient = new RateLimitDecorator(
    new LoggingDecorator(
      new CachingDecorator(
        new RetryDecorator(
          new RealHttpClient(),   // core
          3                       // max 3 retries
        ),
        5000                     // cache 5s
      )
    ),
    100                         // 100 req/s
  );

  console.log("\n--- Request 1 (cache MISS) ---");
  await decorated.get("/api/users");

  console.log("\n--- Request 2 (cache HIT) ---");
  await decorated.get("/api/users");

  console.log("\n--- Request 3 (POST, invalidates cache) ---");
  await decorated.post("/api/users", { name: "Alice" });

  console.log("\n--- Request 4 (cache MISS again) ---");
  await decorated.get("/api/users");
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Decorators STACK: thêm/bớt behavior bằng cách wrap/unwrap
 * 2. Cùng interface HttpClient → transparent cho client
 * 3. Order matters: Request: outer→inner | Response: inner→outer
 * 4. Runtime flexibility: build khác nhau cho dev/staging/prod
 * 5. NestJS equivalents:
 *    - Interceptors = Decorator pattern (logging, caching, transform)
 *    - Guards = Access control decorator
 *    - Pipes = Validation/transform decorator
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ HTTP CLIENT MIDDLEWARE (ví dụ trên)
 *    Bài toán: Gọi API bên thứ 3 cần: logging, caching, retry, rate-limit, circuit-breaker.
 *    Nếu viết hết trong 1 class → 500 dòng, vi phạm SRP.
 *    Giải pháp: Stack decorators: RateLimit → Log → Cache → Retry → HttpClient.
 *    Runtime config: Dev = Log + Http. Prod = RateLimit + Log + Cache + Retry + Http.
 *    Thực tế: Axios interceptors, got hooks, fetch wrapper libraries.
 *
 * 2️⃣ NESTJS INTERCEPTORS (framework thực tế dùng Decorator)
 *    Bài toán: Mọi API endpoint cần: log request/response, transform response format,
 *    cache GET requests, timeout 30s, serialize sensitive fields.
 *    Giải pháp: NestJS Interceptors = Decorator pattern.
 *    @UseInterceptors(LoggingInterceptor, CacheInterceptor, TimeoutInterceptor)
 *    Mỗi interceptor wrap handler, thêm behavior trước/sau.
 *    Order: Request → Log → Cache → Timeout → Handler → Timeout → Cache → Log → Response
 *
 * 3️⃣ STREAM PROCESSING PIPELINE
 *    Bài toán: Đọc file CSV 10GB → parse → validate → transform → compress → upload S3.
 *    Giải pháp: Node.js Streams = Decorator/Pipe pattern.
 *    fs.createReadStream(file)
 *      .pipe(csvParser())        // ← decorator: parse
 *      .pipe(validateStream())   // ← decorator: validate
 *      .pipe(transformStream())  // ← decorator: transform
 *      .pipe(gzip())             // ← decorator: compress
 *      .pipe(s3Upload());        // ← final destination
 *
 * 4️⃣ FUNCTION WRAPPERS (Higher-Order Functions)
 *    Bài toán: Nhiều functions cần retry, measure time, memoize,
 *    debounce — cross-cutting concerns.
 *    Giải pháp: Decorator functions wrap original function:
 *    const safeFetch = retry(3)(log("fetch")(rateLimit(10)(fetch)));
 *    Thực tế: lodash.memoize, lodash.debounce, p-retry, p-throttle.
 *
 * 5️⃣ DATABASE REPOSITORY ENHANCEMENT
 *    Bài toán: UserRepository cần thêm soft-delete, audit log, caching
 *    cho một số deployments nhưng không phải tất cả.
 *    Giải pháp: SoftDeleteDecorator → AuditDecorator → CacheDecorator → UserRepo.
 *    → Enterprise cần audit + cache. Startup chỉ cần basic repo.
 *    → Config tại bootstrap, không sửa UserRepository code.
 *
 * 📌 DECORATOR vs PROXY vs ADAPTER:
 *    Decorator: SAME interface + THÊM behavior (logging, caching)
 *    Proxy: SAME interface + KIỂM SOÁT access (auth, lazy-load)
 *    Adapter: KHÁC interface → CHUYỂN ĐỔI (incompatible → compatible)
 *    → Decorator stack nhiều layers; Proxy thường 1 layer
 */

export { HttpClient, RealHttpClient, LoggingDecorator, CachingDecorator, RetryDecorator, RateLimitDecorator };
