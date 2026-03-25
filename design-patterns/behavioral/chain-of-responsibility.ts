/**
 * Chain of Responsibility Pattern
 * 
 * Cho phép truyền request dọc theo một chuỗi handlers. Mỗi handler
 * quyết định xử lý request hoặc pass cho handler tiếp theo.
 * 
 * Use case: Middleware, validation pipeline, logging, approval workflow
 */

// --- Handler Interface ---
interface Request {
  userId: string;
  role: "guest" | "user" | "admin" | "superadmin";
  ipAddress: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers: Record<string, string>;
  timestamp: Date;
}

interface Response {
  statusCode: number;
  body: any;
}

abstract class Middleware {
  private next: Middleware | null = null;

  setNext(middleware: Middleware): Middleware {
    this.next = middleware;
    return middleware; // Cho phép chaining: a.setNext(b).setNext(c)
  }

  async handle(request: Request): Promise<Response> {
    if (this.next) {
      return this.next.handle(request);
    }
    return { statusCode: 200, body: { message: "OK" } };
  }
}

// --- Concrete Handlers ---

// 1. Rate Limiter
class RateLimiterMiddleware extends Middleware {
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequestsPerMinute: number = 60) {
    super();
    this.maxRequests = maxRequestsPerMinute;
    this.windowMs = 60000;
  }

  async handle(request: Request): Promise<Response> {
    const key = request.ipAddress;
    const now = Date.now();
    const record = this.requestCounts.get(key);

    if (record && now < record.resetAt) {
      if (record.count >= this.maxRequests) {
        console.log(`  ❌ [RateLimit] IP ${key} exceeded ${this.maxRequests} req/min`);
        return { statusCode: 429, body: { error: "Too Many Requests" } };
      }
      record.count++;
    } else {
      this.requestCounts.set(key, { count: 1, resetAt: now + this.windowMs });
    }

    console.log(`  ✅ [RateLimit] Passed`);
    return super.handle(request);
  }
}

// 2. Authentication
class AuthMiddleware extends Middleware {
  private validTokens = new Set(["token-admin-123", "token-user-456", "token-super-789"]);

  async handle(request: Request): Promise<Response> {
    const token = request.headers["authorization"];

    if (!token) {
      console.log(`  ❌ [Auth] No token provided`);
      return { statusCode: 401, body: { error: "Authentication required" } };
    }

    if (!this.validTokens.has(token)) {
      console.log(`  ❌ [Auth] Invalid token`);
      return { statusCode: 401, body: { error: "Invalid token" } };
    }

    console.log(`  ✅ [Auth] Token verified for ${request.userId}`);
    return super.handle(request);
  }
}

// 3. Authorization
class AuthorizationMiddleware extends Middleware {
  private permissions: Record<string, string[]> = {
    "GET": ["guest", "user", "admin", "superadmin"],
    "POST": ["user", "admin", "superadmin"],
    "PUT": ["admin", "superadmin"],
    "DELETE": ["superadmin"],
  };

  async handle(request: Request): Promise<Response> {
    const allowedRoles = this.permissions[request.method] || [];

    if (!allowedRoles.includes(request.role)) {
      console.log(`  ❌ [Authz] ${request.role} cannot ${request.method}`);
      return {
        statusCode: 403,
        body: { error: `Role '${request.role}' is not allowed to ${request.method}` },
      };
    }

    console.log(`  ✅ [Authz] ${request.role} allowed to ${request.method}`);
    return super.handle(request);
  }
}

// 4. Validation
class ValidationMiddleware extends Middleware {
  async handle(request: Request): Promise<Response> {
    if (["POST", "PUT"].includes(request.method) && !request.body) {
      console.log(`  ❌ [Validate] ${request.method} requires body`);
      return { statusCode: 400, body: { error: "Request body is required" } };
    }

    console.log(`  ✅ [Validate] Request is valid`);
    return super.handle(request);
  }
}

// 5. Logging
class LoggingMiddleware extends Middleware {
  async handle(request: Request): Promise<Response> {
    const start = Date.now();
    console.log(`  📝 [Log] ${request.method} ${request.endpoint} from ${request.ipAddress}`);

    const response = await super.handle(request);

    const duration = Date.now() - start;
    console.log(`  📝 [Log] Response: ${response.statusCode} (${duration}ms)`);
    return response;
  }
}

// --- Build the chain ---
function createMiddlewareChain(): Middleware {
  const logging = new LoggingMiddleware();
  const rateLimit = new RateLimiterMiddleware(100);
  const auth = new AuthMiddleware();
  const authz = new AuthorizationMiddleware();
  const validation = new ValidationMiddleware();

  // Chain: Logging → RateLimit → Auth → Authz → Validation
  logging
    .setNext(rateLimit)
    .setNext(auth)
    .setNext(authz)
    .setNext(validation);

  return logging;
}

// --- Usage ---
async function main() {
  const middleware = createMiddlewareChain();

  // Test 1: Valid GET request
  console.log("\n=== Test 1: Valid GET ===");
  const res1 = await middleware.handle({
    userId: "user1",
    role: "user",
    ipAddress: "192.168.1.1",
    endpoint: "/api/users",
    method: "GET",
    headers: { authorization: "token-user-456" },
    timestamp: new Date(),
  });
  console.log("Result:", res1);

  // Test 2: No auth token
  console.log("\n=== Test 2: No Auth ===");
  const res2 = await middleware.handle({
    userId: "guest1",
    role: "guest",
    ipAddress: "10.0.0.1",
    endpoint: "/api/data",
    method: "GET",
    headers: {},
    timestamp: new Date(),
  });
  console.log("Result:", res2);

  // Test 3: Unauthorized DELETE
  console.log("\n=== Test 3: Unauthorized DELETE ===");
  const res3 = await middleware.handle({
    userId: "user1",
    role: "user",
    ipAddress: "192.168.1.1",
    endpoint: "/api/users/1",
    method: "DELETE",
    headers: { authorization: "token-user-456" },
    timestamp: new Date(),
  });
  console.log("Result:", res3);

  // Test 4: POST without body
  console.log("\n=== Test 4: POST without body ===");
  const res4 = await middleware.handle({
    userId: "admin1",
    role: "admin",
    ipAddress: "192.168.1.100",
    endpoint: "/api/users",
    method: "POST",
    headers: { authorization: "token-admin-123" },
    timestamp: new Date(),
  });
  console.log("Result:", res4);

  // Test 5: Full valid POST
  console.log("\n=== Test 5: Valid POST ===");
  const res5 = await middleware.handle({
    userId: "admin1",
    role: "admin",
    ipAddress: "192.168.1.100",
    endpoint: "/api/users",
    method: "POST",
    body: { name: "New User", email: "new@test.com" },
    headers: { authorization: "token-admin-123" },
    timestamp: new Date(),
  });
  console.log("Result:", res5);
}

main();

export { Middleware, RateLimiterMiddleware, AuthMiddleware, AuthorizationMiddleware };

/**
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ HTTP MIDDLEWARE PIPELINE (ví dụ trên)
 *    Bài toán: Mọi HTTP request cần đi qua: CORS → RateLimit → Auth → Authz
 *    → Validation → Handler. Nếu viết if/else trong 1 function → 200 dòng.
 *    Giải pháp: Mỗi middleware = 1 handler, chain nối tiếp.
 *    Fail ở bất kỳ handler nào → trả response ngay, KHÔNG đi tiếp.
 *    Thực tế: Express middleware, NestJS Guards + Pipes + Interceptors,
 *    Koa middleware, Fastify hooks — TẤT CẢ đều dùng Chain of Responsibility.
 *
 * 2️⃣ APPROVAL WORKFLOW (Enterprise)
 *    Bài toán: Đơn mua hàng > $1000 cần Manager approve.
 *    > $5000 cần Director. > $50000 cần CFO. > $100000 cần CEO.
 *    Giải pháp: Chain: TeamLead → Manager → Director → CFO → CEO.
 *    Mỗi handler check xem amount có trong thẩm quyền không.
 *    → Có → approve. Không → chuyển handler tiếp theo.
 *    Code: teamLead.setNext(manager).setNext(director).setNext(cfo);
 *          teamLead.approve(purchaseOrder); // Tự tìm người đủ quyền
 *
 * 3️⃣ FORM VALIDATION CHAIN
 *    Bài toán: Validate form đăng ký: required fields → email format
 *    → password strength → unique email check (DB) → spam detection.
 *    Giải pháp: Mỗi validator = 1 handler trong chain.
 *    RequiredFieldsValidator → EmailFormatValidator → PasswordValidator
 *    → UniqueEmailValidator → SpamDetector.
 *    Fail ở bất kỳ bước → trả error message cụ thể, KHÔNG check tiếp.
 *
 * 4️⃣ EXCEPTION HANDLING HIERARCHY
 *    Bài toán: Exception xảy ra → try local handler → try module handler
 *    → try global handler → log and return 500.
 *    Giải pháp: Chain of catch blocks, mỗi level xử lý khác nhau.
 *    Thực tế: NestJS Exception Filters = Chain of Responsibility:
 *    MethodFilter → ControllerFilter → GlobalFilter.
 *    HttpException → catch bởi MethodFilter. Các exception khác → bubble up.
 *
 * 5️⃣ EVENT PROCESSING / LOGGING PIPELINE
 *    Bài toán: Log event cần: format → enrich (add request ID, user ID)
 *    → filter (skip debug in prod) → route (error→Sentry, info→file, all→console).
 *    Giải pháp: Chain: Formatter → Enricher → Filter → Router.
 *    Thực tế: Winston transports, Pino pipelines, ELK stack processors.
 *
 * 📌 CHAIN vs DECORATOR vs MIDDLEWARE:
 *    Chain: mỗi handler CÓ THỂ dừng chain (reject request)
 *    Decorator: mọi decorator đều forward, chỉ thêm behavior
 *    Middleware (Express): = Chain + Decorator kết hợp (next() = forward)
 */
