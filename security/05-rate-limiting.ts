/**
 * ============================================
 * SECURITY #5: RATE LIMITING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Rate limit mọi public endpoint — ngăn brute force, DDoS
 * 2. Limit khác nhau cho từng endpoint (login stricter hơn list)
 * 3. Redis-based cho distributed systems
 * 4. Sliding window algorithm chính xác hơn fixed window
 * 5. Trả headers thông báo limit cho client
 * 6. Whitelist cho internal services / health check
 */

// ═══════════════════════════════════════════
// Rule 5.1: Basic Rate Limiting
// ═══════════════════════════════════════════

// ❌ BAD: Không có rate limiting
/*
@Post('auth/login')
async login(@Body() dto: LoginDto) {
  // Attacker gửi 10,000 requests/second → brute force password!
  return this.authService.login(dto);
}
*/

// ✅ GOOD: NestJS Throttler
/*
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,     // 1 second
        limit: 3,       // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,    // 10 seconds
        limit: 20,      // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,    // 1 minute
        limit: 100,     // 100 requests per minute
      },
    ]),
  ],
})

// Global guard
app.useGlobalGuards(new ThrottlerGuard());
*/

// ═══════════════════════════════════════════
// Rule 5.2: Per-Endpoint Rate Limiting
// ═══════════════════════════════════════════

// ✅ GOOD: Limit khác nhau cho từng endpoint
/*
@Controller('auth')
export class AuthController {
  // Login: strict — 5 requests per minute
  @Post('login')
  @Throttle({ short: { limit: 1, ttl: 1000 }, long: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {}

  // Register: strict — 3 per minute
  @Post('register')
  @Throttle({ long: { limit: 3, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {}

  // Forgot password: very strict — 3 per hour
  @Post('forgot-password')
  @Throttle({ long: { limit: 3, ttl: 3600000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {}
}

@Controller('products')
export class ProductController {
  // List: relaxed — 60 per minute
  @Get()
  @Throttle({ long: { limit: 60, ttl: 60000 } })
  async findAll() {}

  // Skip rate limiting cho health check
  @Get('health')
  @SkipThrottle()
  healthCheck() { return { status: 'ok' }; }
}
*/

// ═══════════════════════════════════════════
// Rule 5.3: Sliding Window Algorithm (Redis)
// ═══════════════════════════════════════════

// Fixed window: 100 req/min → nhưng 100 req cuối window + 100 đầu window = 200 req/2s
// Sliding window: đếm chính xác hơn, tránh burst ở boundary

class SlidingWindowRateLimiter {
  private store = new Map<string, number[]>();

  isAllowed(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps, filter expired
    const timestamps = (this.store.get(key) || []).filter(t => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: retryAfter,
        limit: maxRequests,
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: true,
      remaining: maxRequests - timestamps.length,
      retryAfterSeconds: 0,
      limit: maxRequests,
    };
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

// ✅ Redis implementation:
/*
class RedisSlidingWindowRateLimiter {
  constructor(private readonly redis: Redis) {}

  async isAllowed(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    // Atomic operation with Lua script
    const luaScript = `
      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])

      -- Count current entries
      local count = redis.call('ZCARD', KEYS[1])

      if count < tonumber(ARGV[2]) then
        -- Add new entry
        redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
        redis.call('PEXPIRE', KEYS[1], ARGV[4])
        return {1, tonumber(ARGV[2]) - count - 1} -- allowed, remaining
      else
        -- Get oldest entry for retry-after
        local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
        return {0, oldest[2]} -- denied, oldest timestamp
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1, redisKey,
      windowStart, maxRequests, now, windowMs,
    );

    const [allowed, value] = result as [number, number];

    if (allowed === 1) {
      return {
        allowed: true,
        remaining: value,
        retryAfterSeconds: 0,
        limit: maxRequests,
      };
    }

    const retryAfter = Math.ceil((value + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfter,
      limit: maxRequests,
    };
  }
}
*/

// ═══════════════════════════════════════════
// Rule 5.4: Rate Limit Response Headers
// ═══════════════════════════════════════════

// ✅ GOOD: Trả headers để client biết limit

/*
// rate-limit.interceptor.ts
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly rateLimiter: RedisSlidingWindowRateLimiter) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Key = IP + endpoint (hoặc userId nếu authenticated)
    const key = request.user?.id
      ? `user:${request.user.id}:${request.path}`
      : `ip:${request.ip}:${request.path}`;

    const result = await this.rateLimiter.isAllowed(key, 100, 60000);

    // Luôn set headers
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfterSeconds);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Too Many Requests',
          retryAfter: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle();
  }
}
*/

// ═══════════════════════════════════════════
// Rule 5.5: Rate Limit Tiers
// ═══════════════════════════════════════════

// ✅ GOOD: Khác nhau theo user tier
const RATE_LIMIT_TIERS = {
  anonymous: {
    global: { requests: 30, windowMs: 60_000 },
    login: { requests: 5, windowMs: 300_000 },
    register: { requests: 3, windowMs: 3600_000 },
  },
  free: {
    global: { requests: 100, windowMs: 60_000 },
    login: { requests: 10, windowMs: 300_000 },
    api: { requests: 1000, windowMs: 3600_000 },
  },
  premium: {
    global: { requests: 500, windowMs: 60_000 },
    login: { requests: 20, windowMs: 300_000 },
    api: { requests: 10000, windowMs: 3600_000 },
  },
  internal: {
    global: { requests: 10000, windowMs: 60_000 },
    login: { requests: 100, windowMs: 300_000 },
    api: { requests: 100000, windowMs: 3600_000 },
  },
};

export {
  SlidingWindowRateLimiter,
  RATE_LIMIT_TIERS,
  type RateLimitResult,
};
