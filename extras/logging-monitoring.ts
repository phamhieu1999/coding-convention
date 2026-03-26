/**
 * ============================================
 * LOGGING & MONITORING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Structured logging (JSON) — dễ parse, dễ search
 * 2. Correlation ID — trace request across services
 * 3. Log levels đúng cách — không spam, không thiếu
 * 4. Không log sensitive data (password, token, PII)
 * 5. Request/Response logging có chọn lọc
 * 6. Health check endpoint cho monitoring
 */

declare const process: { env: Record<string, string | undefined> };

// ═══════════════════════════════════════════
// Rule 1: Structured Logging (JSON format)
// ═══════════════════════════════════════════

// ❌ BAD: console.log rải rác, không structured
/*
console.log('User created: ' + user.email);
console.log('Order failed', error);
console.log('DEBUG: payment response', JSON.stringify(paymentRes));
*/

// ✅ GOOD: Structured logger with context
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  error?: { message: string; stack?: string; code?: string };
  duration?: number;
}

class StructuredLogger {
  constructor(private readonly context: string) {}

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context: this.context,
      data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
    };
    console.error(JSON.stringify(entry));
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
    };
    console.log(JSON.stringify(entry));
  }
}

// Output:
// {"timestamp":"2024-01-15T10:30:00Z","level":"info","message":"User created","context":"UserService","data":{"userId":"123","email":"john@test.com"}}

// ═══════════════════════════════════════════
// Rule 2: Correlation ID — Trace Across Services
// ═══════════════════════════════════════════

// ❌ BAD: Không có correlation → không trace được request flow
/*
// UserService log: "User created"
// OrderService log: "Order created"
// PaymentService log: "Payment processed"
// → Không biết 3 logs này thuộc cùng 1 request!
*/

// ✅ GOOD: Correlation ID middleware
/*
// correlation.middleware.ts
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// Store correlation ID per request
export const requestContext = new AsyncLocalStorage<{ correlationId: string }>();

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Lấy từ header (nếu upstream service gửi) hoặc tạo mới
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();

    // Set response header
    res.setHeader('X-Correlation-ID', correlationId);

    // Store in async context — accessible everywhere in this request
    requestContext.run({ correlationId }, () => next());
  }
}

// Logger lấy correlation ID tự động:
class CorrelatedLogger {
  log(message: string, data?: Record<string, unknown>): void {
    const store = requestContext.getStore();
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: store?.correlationId,
      message,
      data,
    };
    console.log(JSON.stringify(entry));
  }
}
*/

// ═══════════════════════════════════════════
// Rule 3: Log Levels — Khi nào dùng gì
// ═══════════════════════════════════════════

const LOG_LEVEL_GUIDE = {
  ERROR: {
    description: 'Lỗi cần xử lý ngay, ảnh hưởng user',
    examples: [
      'Database connection failed',
      'Payment processing error',
      'Unhandled exception',
      'External service timeout (critical path)',
    ],
    action: 'Alert team (PagerDuty, Slack)',
  },
  WARN: {
    description: 'Không lỗi nhưng cần chú ý, potential issue',
    examples: [
      'Rate limit approaching threshold',
      'Cache miss rate > 50%',
      'Deprecated API version called',
      'Retry attempt on external service',
      'Slow query > 5s',
    ],
    action: 'Review trong daily monitoring',
  },
  INFO: {
    description: 'Business events quan trọng, audit trail',
    examples: [
      'User registered',
      'Order created / cancelled',
      'Payment processed',
      'Deployment started / completed',
      'Scheduled job executed',
    ],
    action: 'Normal log aggregation',
  },
  DEBUG: {
    description: 'Chi tiết kỹ thuật, chỉ bật ở development',
    examples: [
      'SQL query executed',
      'Cache hit/miss',
      'Request/response payload',
      'Function entry/exit with params',
    ],
    action: 'Off in production (unless debugging)',
  },
};

// ═══════════════════════════════════════════
// Rule 4: Sensitive Data — KHÔNG BAO GIỜ LOG
// ═══════════════════════════════════════════

// ❌ BAD: Log sensitive data
/*
logger.info('Login attempt', {
  email: user.email,
  password: dto.password,       // TUYỆT ĐỐI KHÔNG!
  token: jwt,                   // TUYỆT ĐỐI KHÔNG!
  creditCard: user.creditCard,  // TUYỆT ĐỐI KHÔNG!
  ssn: user.ssn,                // TUYỆT ĐỐI KHÔNG!
});
*/

// ✅ GOOD: Sanitize trước khi log
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'apiKey', 'api_key',
  'authorization', 'creditCard', 'credit_card', 'ssn',
  'cvv', 'pin', 'otp', 'refreshToken', 'refresh_token',
];

function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Mask email: j***@example.com
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

// ═══════════════════════════════════════════
// Rule 5: Request/Response Logging
// ═══════════════════════════════════════════

// ✅ GOOD: Logging interceptor
/*
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = request.user?.id || 'anonymous';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.logger.log(JSON.stringify({
            type: 'http_request',
            method, url,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            userId,
            ip,
            userAgent: userAgent.substring(0, 100),
          }));

          // Alert on slow requests
          if (duration > 5000) {
            this.logger.warn(`Slow request: ${method} ${url} took ${duration}ms`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logger.error(JSON.stringify({
            type: 'http_error',
            method, url,
            statusCode: error.status || 500,
            duration: `${duration}ms`,
            userId,
            error: error.message,
          }));
        },
      }),
    );
  }
}
*/

// ═══════════════════════════════════════════
// Rule 6: Health Check Endpoint
// ═══════════════════════════════════════════

// ✅ GOOD: Health check cho monitoring tools
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: Record<string, ComponentHealth>;
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
}

class HealthCheckService {
  private readonly startTime = Date.now();

  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, ComponentHealth> = {};

    checks.database = await this.checkDatabase();
    checks.redis = await this.checkRedis();
    checks.memory = this.checkMemory();
    checks.disk = this.checkDisk();

    const hasUnhealthy = Object.values(checks).some(c => c.status === 'down');
    const hasDegraded = Object.values(checks).some(c => c.status === 'degraded');

    return {
      status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const start = Date.now();
      // await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    try {
      const start = Date.now();
      // await this.redis.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }

  private checkMemory(): ComponentHealth {
    const usage = process.env.NODE_ENV ? 60 : 50; // Simulate
    if (usage > 90) return { status: 'down', message: `Memory usage: ${usage}%` };
    if (usage > 70) return { status: 'degraded', message: `Memory usage: ${usage}%` };
    return { status: 'up', message: `Memory usage: ${usage}%` };
  }

  private checkDisk(): ComponentHealth {
    return { status: 'up', message: 'Disk usage: 45%' };
  }
}

/*
// Controller:
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthCheckService) {}

  @Get()
  @SkipThrottle()
  async check(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();

    // Return 503 if unhealthy
    if (result.status === 'unhealthy') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  // Lightweight liveness probe (K8s)
  @Get('live')
  @SkipThrottle()
  live(): { status: string } {
    return { status: 'ok' };
  }

  // Readiness probe (K8s)
  @Get('ready')
  @SkipThrottle()
  async ready(): Promise<{ status: string }> {
    const result = await this.healthService.check();
    if (result.status === 'unhealthy') {
      throw new ServiceUnavailableException('Not ready');
    }
    return { status: 'ready' };
  }
}
*/

// ═══════════════════════════════════════════
// Rule 7: Metrics Collection
// ═══════════════════════════════════════════

// ✅ GOOD: Application metrics cho Prometheus / Grafana

class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000) values.shift(); // Bounded
    this.histograms.set(key, values);
  }

  getSnapshot(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            p95: this.percentile(values, 95),
            p99: this.percentile(values, 99),
            max: Math.max(...values),
          },
        ]),
      ),
    };
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    return `${name}{${labelStr}}`;
  }
}

// Key metrics to track:
const RECOMMENDED_METRICS = {
  'http_requests_total':          'Counter — total requests by method, path, status',
  'http_request_duration_ms':     'Histogram — response time by endpoint',
  'db_query_duration_ms':         'Histogram — query execution time',
  'cache_hits_total':             'Counter — cache hit vs miss',
  'queue_jobs_processed_total':   'Counter — jobs processed by queue, status',
  'queue_job_duration_ms':        'Histogram — job processing time',
  'active_connections':           'Gauge — current DB/Redis connections',
  'memory_usage_bytes':           'Gauge — heap used, RSS',
  'error_count_total':            'Counter — errors by type/code',
};

export {
  StructuredLogger,
  HealthCheckService,
  MetricsCollector,
  sanitizeForLog,
  maskEmail,
  LOG_LEVEL_GUIDE,
  SENSITIVE_FIELDS,
  RECOMMENDED_METRICS,
  LogLevel,
  type LogEntry,
  type HealthCheckResult,
  type ComponentHealth,
};
