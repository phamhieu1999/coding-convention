/**
 * ============================================
 * CLEAN CODE RULE #17: DEFENSIVE PROGRAMMING & INPUT VALIDATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. Validate ở boundary (API input, user input)
 * 2. Fail fast — phát hiện lỗi sớm nhất có thể
 * 3. Sanitize data trước khi xử lý
 * 4. Null Object pattern thay vì scattered null checks
 * 5. Assertion functions cho invariants
 */

// ═══════════════════════════════════════════
// Rule 17.1: Validate ở boundary → trust bên trong
// ═══════════════════════════════════════════

// ❌ BAD: Check null/undefined rải rác khắp nơi
class UserService_BAD {
  async getProfile(userId: string) {
    if (!userId) return null;   // Check #1
    const user = await this.findUser(userId);
    if (!user) return null;     // Check #2
    if (!user.name) return null; // Check #3 — vô nghĩa
    return user;
  }

  private async findUser(_id: string) { return { name: 'John', email: 'j@mail.com' }; }
}

// ✅ GOOD: Validate 1 lần ở boundary → code bên trong clean
interface CreateUserInput {
  name: string;
  email: string;
  age: number;
}

interface ValidationError {
  field: string;
  message: string;
}

function validateCreateUser(input: unknown): CreateUserInput {
  const errors: ValidationError[] = [];

  if (!input || typeof input !== 'object') {
    throw new InvalidInputError('Input must be an object');
  }

  const data = input as Record<string, unknown>;

  if (typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }

  if (typeof data.email !== 'string' || !data.email.includes('@')) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }

  if (typeof data.age !== 'number' || data.age < 0 || data.age > 150) {
    errors.push({ field: 'age', message: 'Age must be between 0 and 150' });
  }

  if (errors.length > 0) {
    throw new ValidationFailedError(errors);
  }

  return {
    name: (data.name as string).trim(),
    email: (data.email as string).toLowerCase().trim(),
    age: data.age as number,
  };
}

// ═══════════════════════════════════════════
// Rule 17.2: Custom Error classes
// ═══════════════════════════════════════════

class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

class ValidationFailedError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`Validation failed: ${errors.map((e) => e.message).join(', ')}`);
    this.name = 'ValidationFailedError';
  }
}

class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

// ═══════════════════════════════════════════
// Rule 17.3: Sanitize input — chống injection
// ═══════════════════════════════════════════

// ❌ BAD: Dùng input trực tiếp → XSS, injection
function displayComment_BAD(comment: string): string {
  return `<div>${comment}</div>`; // XSS nếu comment chứa <script>!
}

// ✅ GOOD: Sanitize trước khi dùng
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function displayComment(comment: string): string {
  return `<div>${escapeHtml(comment)}</div>`;
}

// Sanitize cho SQL-like input (dù nên dùng parameterized queries)
function sanitizeSearchTerm(term: string): string {
  return term
    .trim()
    .slice(0, 100) // limit length
    .replace(/[%_\\]/g, '\\$&'); // escape SQL wildcards
}

// ═══════════════════════════════════════════
// Rule 17.4: Null Object Pattern
// ═══════════════════════════════════════════

// ❌ BAD: Null checks rải rác
interface Logger_BAD {
  log(msg: string): void;
}

function process_BAD(logger: Logger_BAD | null) {
  // Phải check null mỗi lần gọi
  if (logger) logger.log('Starting...');
  // ... business logic ...
  if (logger) logger.log('Done');
}

// ✅ GOOD: Null Object — cùng interface, nhưng không làm gì
interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, err?: Error): void;
}

class ConsoleLogger implements ILogger {
  info(msg: string) { console.log(`[INFO] ${msg}`); }
  warn(msg: string) { console.warn(`[WARN] ${msg}`); }
  error(msg: string, err?: Error) { console.error(`[ERROR] ${msg}`, err); }
}

// Null Object — "im lặng", không log gì cả
class NullLogger implements ILogger {
  info(_msg: string) { /* no-op */ }
  warn(_msg: string) { /* no-op */ }
  error(_msg: string, _err?: Error) { /* no-op */ }
}

// Không cần check null, luôn gọi được
function processData(data: unknown[], logger: ILogger = new NullLogger()): void {
  logger.info(`Processing ${data.length} items`);
  // ... business logic ...
  logger.info('Processing complete');
}

// ═══════════════════════════════════════════
// Rule 17.5: Defensive defaults & coalescing
// ═══════════════════════════════════════════

interface AppConfig {
  port?: number;
  host?: string;
  timeout?: number;
  maxRetries?: number;
}

// ❌ BAD: Scattered defaults, inconsistent
function startServer_BAD(config: AppConfig) {
  const port = config.port || 3000;      // Bug: port = 0 bị override thành 3000!
  const timeout = config.timeout || 5000; // Bug: timeout = 0 cũng bị override!
}

// ✅ GOOD: Object defaults + nullish coalescing (??)
const DEFAULT_CONFIG: Required<AppConfig> = {
  port: 3000,
  host: 'localhost',
  timeout: 5000,
  maxRetries: 3,
} as const;

function createConfig(overrides: AppConfig = {}): Required<AppConfig> {
  return {
    port: overrides.port ?? DEFAULT_CONFIG.port,
    host: overrides.host ?? DEFAULT_CONFIG.host,
    timeout: overrides.timeout ?? DEFAULT_CONFIG.timeout,
    maxRetries: overrides.maxRetries ?? DEFAULT_CONFIG.maxRetries,
  };
}

// ═══════════════════════════════════════════
// Rule 17.6: Safe property access
// ═══════════════════════════════════════════

interface ApiResponse {
  data?: {
    user?: {
      address?: {
        city?: string;
      };
    };
  };
}

// ❌ BAD: Verbose null checks
function getCity_BAD(response: ApiResponse): string {
  if (response.data && response.data.user && response.data.user.address) {
    return response.data.user.address.city || 'Unknown';
  }
  return 'Unknown';
}

// ✅ GOOD: Optional chaining + nullish coalescing
function getCity(response: ApiResponse): string {
  return response.data?.user?.address?.city ?? 'Unknown';
}

export {
  validateCreateUser,
  InvalidInputError,
  ValidationFailedError,
  NotFoundError,
  escapeHtml,
  sanitizeSearchTerm,
  NullLogger,
  ConsoleLogger,
  createConfig,
  getCity,
};
