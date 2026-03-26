/**
 * ============================================
 * ERROR HANDLING STRATEGY
 * ============================================
 *
 * Nguyên tắc:
 * 1. Domain error taxonomy — phân loại lỗi rõ ràng
 * 2. Error codes mapping — mỗi lỗi có unique code
 * 3. Circuit breaker — ngăn cascade failure
 * 4. Retry with backoff — tự phục hồi transient errors
 * 5. Graceful degradation — hệ thống vẫn hoạt động khi partial failure
 * 6. Error boundary — không leak internal errors ra client
 */

// ═══════════════════════════════════════════
// Rule 1: Domain Error Taxonomy
// ═══════════════════════════════════════════

// ❌ BAD: Throw generic errors
/*
throw new Error('Something went wrong');
throw new HttpException('Error', 400);
throw new Error('Not found');
*/

// ✅ GOOD: Structured domain error hierarchy
abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly timestamp = new Date().toISOString();

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toResponse(): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        details: this.details,
      },
    };
  }
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    details?: Record<string, unknown>;
  };
}

// ── Business Rule Errors (4xx) ──
class ValidationException extends DomainException {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
}

class ResourceNotFoundException extends DomainException {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(resource: string, identifier: string) {
    super(`${resource} with ID '${identifier}' not found`, { resource, identifier });
  }
}

class DuplicateResourceException extends DomainException {
  readonly code = 'DUPLICATE_RESOURCE';
  readonly httpStatus = 409;

  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, { resource, field });
  }
}

class BusinessRuleException extends DomainException {
  code = 'BUSINESS_RULE_VIOLATION';
  readonly httpStatus = 422;
}

class InsufficientBalanceException extends BusinessRuleException {
  override readonly code = 'INSUFFICIENT_BALANCE';

  constructor(current: number, required: number) {
    super(`Insufficient balance: have ${current}, need ${required}`, { current, required });
  }
}

class UnauthorizedException extends DomainException {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

class ForbiddenException extends DomainException {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
}

// ── Infrastructure Errors (5xx) ──
class ExternalServiceException extends DomainException {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly httpStatus = 502;

  constructor(service: string, originalError?: Error) {
    super(`External service '${service}' failed`, {
      service,
      originalError: originalError?.message,
    });
  }
}

class ServiceUnavailableException extends DomainException {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;
}

// ═══════════════════════════════════════════
// Rule 2: Error Code Registry
// ═══════════════════════════════════════════

// ✅ GOOD: Centralized error codes → dễ tra cứu, dễ document
const ERROR_CODES = {
  // Auth (1xxx)
  AUTH_INVALID_CREDENTIALS: { code: 1001, message: 'Invalid email or password' },
  AUTH_TOKEN_EXPIRED: { code: 1002, message: 'Token has expired' },
  AUTH_TOKEN_INVALID: { code: 1003, message: 'Invalid token' },
  AUTH_ACCOUNT_LOCKED: { code: 1004, message: 'Account is locked' },

  // User (2xxx)
  USER_NOT_FOUND: { code: 2001, message: 'User not found' },
  USER_EMAIL_DUPLICATE: { code: 2002, message: 'Email already exists' },
  USER_INACTIVE: { code: 2003, message: 'User account is inactive' },

  // Order (3xxx)
  ORDER_NOT_FOUND: { code: 3001, message: 'Order not found' },
  ORDER_CANNOT_CANCEL: { code: 3002, message: 'Order cannot be cancelled in current status' },
  ORDER_INSUFFICIENT_STOCK: { code: 3003, message: 'Insufficient stock for requested items' },

  // Payment (4xxx)
  PAYMENT_FAILED: { code: 4001, message: 'Payment processing failed' },
  PAYMENT_INSUFFICIENT_BALANCE: { code: 4002, message: 'Insufficient balance' },
  PAYMENT_GATEWAY_TIMEOUT: { code: 4003, message: 'Payment gateway timeout' },

  // System (9xxx)
  INTERNAL_ERROR: { code: 9001, message: 'Internal server error' },
  DATABASE_ERROR: { code: 9002, message: 'Database operation failed' },
  EXTERNAL_SERVICE_ERROR: { code: 9003, message: 'External service unavailable' },
  RATE_LIMIT_EXCEEDED: { code: 9004, message: 'Too many requests' },
} as const;

// ═══════════════════════════════════════════
// Rule 3: Circuit Breaker
// ═══════════════════════════════════════════

// ❌ BAD: Gọi external service liên tục dù đang down → cascade failure
/*
async callPaymentGateway(data: any): Promise<any> {
  return axios.post('https://payment.example.com/charge', data);
  // Service down → 30s timeout × 1000 requests = tất cả đều chờ!
}
*/

// ✅ GOOD: Circuit breaker — ngắt mạch khi service down
enum CircuitState {
  CLOSED = 'CLOSED',       // Normal — requests go through
  OPEN = 'OPEN',           // Tripped — requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing — allow limited requests
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = {},
  ) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30_000,
      halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? 3,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs!) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] → HALF_OPEN`);
      } else {
        throw new ServiceUnavailableException(
          `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxAttempts!) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        console.log(`[CircuitBreaker:${this.name}] → CLOSED (recovered)`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.state = CircuitState.OPEN;
      console.log(`[CircuitBreaker:${this.name}] → OPEN (${this.failureCount} failures)`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

// ═══════════════════════════════════════════
// Rule 4: Retry with Exponential Backoff
// ═══════════════════════════════════════════

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error as Error)) throw error;

      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        const jitter = delay * 0.1 * Math.random();
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}

function isRetryableError(error: Error): boolean {
  // Network errors, timeouts, 5xx → retry
  const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
  const code = (error as any).code;
  if (code && retryableCodes.includes(code)) return true;

  const status = (error as any).status || (error as any).statusCode;
  if (status && status >= 500) return true;

  return false;
}

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════
// Rule 5: Graceful Degradation
// ═══════════════════════════════════════════

// ✅ GOOD: Fallback khi dependency fail
class ProductService_Resilient {
  async getProduct(id: string): Promise<unknown> {
    // Try cache first
    try {
      const cached = await this.getFromCache(id);
      if (cached) return cached;
    } catch {
      // Cache down → continue without cache
    }

    // Try primary DB
    try {
      return await this.getFromPrimaryDb(id);
    } catch {
      // Primary down → try replica
      try {
        return await this.getFromReplicaDb(id);
      } catch {
        // All down → return stale data or default
        return this.getStaleOrDefault(id);
      }
    }
  }

  private async getFromCache(_id: string): Promise<unknown> { return null; }
  private async getFromPrimaryDb(id: string): Promise<unknown> { return { id }; }
  private async getFromReplicaDb(id: string): Promise<unknown> { return { id }; }
  private getStaleOrDefault(id: string): unknown { return { id, stale: true }; }
}

export {
  DomainException,
  ValidationException,
  ResourceNotFoundException,
  DuplicateResourceException,
  BusinessRuleException,
  InsufficientBalanceException,
  UnauthorizedException,
  ForbiddenException,
  ExternalServiceException,
  ServiceUnavailableException,
  CircuitBreaker,
  CircuitState,
  ProductService_Resilient,
  retryWithBackoff,
  isRetryableError,
  ERROR_CODES,
  type ErrorResponse,
  type CircuitBreakerOptions,
  type RetryOptions,
};
