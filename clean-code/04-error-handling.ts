/**
 * ============================================
 * CLEAN CODE RULE #4: ERROR HANDLING (Xử lý lỗi)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng custom error classes thay vì generic Error
 * 2. Không nuốt lỗi (swallow errors)
 * 3. Fail fast - phát hiện lỗi sớm nhất có thể
 * 4. Dùng Result pattern thay vì throw khi cần
 * 5. Log đủ context để debug
 * 6. Phân biệt operational errors vs programming errors
 */

// ═══════════════════════════════════════════
// Rule 4.1: Custom Error Classes
// ═══════════════════════════════════════════

// ❌ BAD: Generic error, không phân biệt được loại lỗi
function findUser_BAD(id: string) {
  throw new Error('Not found');
}

function login_BAD(email: string) {
  throw new Error('Unauthorized');
}

// ✅ GOOD: Custom error hierarchy
abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;

  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, { resource, identifier });
  }
}

class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(reason: string) {
    super(`Unauthorized: ${reason}`, { reason });
  }
}

class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(
    public readonly errors: Record<string, string>,
  ) {
    super('Validation failed', { errors });
  }
}

class InternalError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false; // programming error → cần alert

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

// Sử dụng:
function findUserById(id: string): { id: string; name: string } {
  const users = new Map([['1', { id: '1', name: 'John' }]]);
  const user = users.get(id);

  if (!user) throw new NotFoundError('User', id);
  return user;
}

// ═══════════════════════════════════════════
// Rule 4.2: Không nuốt lỗi
// ═══════════════════════════════════════════

// ❌ BAD: Nuốt lỗi, không biết chuyện gì xảy ra
async function saveData_BAD(data: unknown) {
  try {
    console.log('Saving:', data);
  } catch (error) {
    // Lỗi bị nuốt hoàn toàn
  }
}

// ❌ BAD: Log nhưng không xử lý hay re-throw
async function saveData_BAD2(data: unknown) {
  try {
    console.log('Saving:', data);
  } catch (error) {
    console.log('Error occurred'); // Mất context, flow tiếp tục sai
  }
}

// ✅ GOOD: Xử lý hoặc re-throw với đầy đủ context
async function saveData(data: unknown): Promise<void> {
  try {
    console.log('Saving:', data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new InternalError(`Failed to save data: ${message}`, {
      originalError: message,
      data,
    });
  }
}

// ═══════════════════════════════════════════
// Rule 4.3: Result Pattern (thay vì throw)
// ═══════════════════════════════════════════

// Dùng khi lỗi là trường hợp BÌNH THƯỜNG (expected),
// không phải exceptional case

type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

function fail<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ❌ BAD: Throw cho business logic thông thường
function parseAge_BAD(input: string): number {
  const age = parseInt(input, 10);
  if (isNaN(age)) throw new Error('Invalid age');
  if (age < 0 || age > 150) throw new Error('Age out of range');
  return age;
}

// ✅ GOOD: Result pattern cho expected failures
function parseAge(input: string): Result<number, string> {
  const age = parseInt(input, 10);
  if (isNaN(age)) return fail(`"${input}" is not a valid number`);
  if (age < 0 || age > 150) return fail(`Age ${age} is out of range (0-150)`);
  return ok(age);
}

// Sử dụng:
function handleAgeInput(input: string): void {
  const result = parseAge(input);

  if (!result.success) {
    console.log(`Validation error: ${result.error}`);
    return;
  }

  console.log(`Valid age: ${result.data}`);
}

// ═══════════════════════════════════════════
// Rule 4.4: Centralized Error Handler
// ═══════════════════════════════════════════

class ErrorHandler {
  handle(error: unknown): { statusCode: number; message: string } {
    if (error instanceof AppError) {
      if (!error.isOperational) {
        this.alertDevTeam(error);
      }
      this.logError(error);
      return { statusCode: error.statusCode, message: error.message };
    }

    // Unknown error → treat as internal
    const unknownError = error instanceof Error ? error.message : 'Unknown';
    this.alertDevTeam(new InternalError(unknownError));
    return { statusCode: 500, message: 'Internal server error' };
  }

  private logError(error: AppError): void {
    console.error(JSON.stringify({
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      context: error.context,
      timestamp: new Date().toISOString(),
    }));
  }

  private alertDevTeam(error: AppError): void {
    console.error(`🚨 CRITICAL: ${error.message}`, error.context);
    // Gửi alert qua Slack, PagerDuty, etc.
  }
}

export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  InternalError,
  ErrorHandler,
  ok,
  fail,
  type Result,
};
