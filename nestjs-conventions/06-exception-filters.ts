/**
 * ============================================
 * NESTJS CONVENTION #6: EXCEPTION FILTERS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Global exception filter bắt tất cả unhandled errors
 * 2. Custom exception classes cho từng domain
 * 3. Error response format thống nhất
 * 4. Không expose stack trace, internal info trong production
 * 5. Log đủ context để debug (request ID, user, payload)
 * 6. Phân biệt operational vs programming errors
 */

// ═══════════════════════════════════════════
// Rule 6.1: Custom Domain Exceptions
// ═══════════════════════════════════════════

// ❌ BAD: Dùng generic HttpException, message mơ hồ
/*
throw new HttpException('Error', 400);
throw new BadRequestException('Invalid');
throw new Error('Something went wrong'); // Trả về 500 mà không có context
*/

// ✅ GOOD: Custom exception hierarchy
abstract class DomainException extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  readonly isOperational: boolean = true;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ResourceNotFoundException extends DomainException {
  readonly statusCode = 404;
  readonly errorCode = 'RESOURCE_NOT_FOUND';

  constructor(resource: string, identifier: string | number) {
    super(`${resource} with identifier '${identifier}' not found`, {
      resource,
      identifier,
    });
  }
}

class BusinessRuleViolationException extends DomainException {
  readonly statusCode = 422;
  readonly errorCode = 'BUSINESS_RULE_VIOLATION';

  constructor(rule: string, details?: Record<string, unknown>) {
    super(`Business rule violated: ${rule}`, details);
  }
}

class DuplicateResourceException extends DomainException {
  readonly statusCode = 409;
  readonly errorCode = 'DUPLICATE_RESOURCE';

  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, {
      resource,
      field,
      value,
    });
  }
}

class InsufficientPermissionException extends DomainException {
  readonly statusCode = 403;
  readonly errorCode = 'INSUFFICIENT_PERMISSION';

  constructor(action: string, resource: string) {
    super(`You don't have permission to ${action} this ${resource}`, {
      action,
      resource,
    });
  }
}

// Sử dụng trong service:
/*
async cancelOrder(orderId: string, userId: string): Promise<void> {
  const order = await this.orderRepo.findById(orderId);
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  if (order.userId !== userId) {
    throw new InsufficientPermissionException('cancel', 'order');
  }

  if (order.status === 'SHIPPED') {
    throw new BusinessRuleViolationException(
      'Cannot cancel shipped order',
      { orderId, currentStatus: order.status },
    );
  }
}
*/

// ═══════════════════════════════════════════
// Rule 6.2: Global Exception Filter
// ═══════════════════════════════════════════

// ❌ BAD: Không có global filter → mỗi controller try/catch riêng
/*
@Get(':id')
async findOne(@Param('id') id: string) {
  try {
    return await this.service.findById(id);
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw new HttpException('Not found', 404);
    }
    throw new HttpException('Internal error', 500); // Mất error info
  }
}
*/

// ✅ GOOD: Global Exception Filter xử lý tập trung
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

/*
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const errorResponse = this.buildErrorResponse(exception, request);
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.error.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: any): ErrorResponse {
    // Domain exceptions (business errors)
    if (exception instanceof DomainException) {
      return {
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId: request.requestId,
        },
      };
    }

    // NestJS built-in HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      return {
        success: false,
        error: {
          code: `HTTP_${status}`,
          message: typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId: request.requestId,
        },
      };
    }

    // Unknown/programming errors → 500
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : (exception instanceof Error ? exception.message : 'Unknown error'),
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.requestId,
      },
    };
  }

  private logError(exception: unknown, request: any, response: ErrorResponse): void {
    const logContext = {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      userId: request.user?.id,
      body: request.body,
      error: response.error,
    };

    if (exception instanceof DomainException && exception.isOperational) {
      this.logger.warn(JSON.stringify(logContext));
    } else {
      this.logger.error(JSON.stringify(logContext));
      // Alert team for non-operational errors
    }
  }
}

// main.ts — Register globally
app.useGlobalFilters(new GlobalExceptionFilter());
*/

// ═══════════════════════════════════════════
// Rule 6.3: Validation Exception Mapping
// ═══════════════════════════════════════════

// ✅ GOOD: Map class-validator errors thành format chuẩn
interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: 'Validation failed';
    details: {
      field: string;
      constraints: string[];
    }[];
    timestamp: string;
    path: string;
  };
}

/*
// Trong ValidationPipe config:
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => {
    const details = errors.map((error) => ({
      field: error.property,
      constraints: Object.values(error.constraints || {}),
    }));

    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
    });
  },
}));
*/

// ═══════════════════════════════════════════
// Rule 6.4: Error Code Registry
// ═══════════════════════════════════════════

// ✅ GOOD: Centralized error code enum
enum ErrorCode {
  // Auth errors (1xxx)
  AUTH_INVALID_CREDENTIALS = 'AUTH_1001',
  AUTH_TOKEN_EXPIRED = 'AUTH_1002',
  AUTH_INSUFFICIENT_PERMISSION = 'AUTH_1003',

  // User errors (2xxx)
  USER_NOT_FOUND = 'USER_2001',
  USER_EMAIL_TAKEN = 'USER_2002',
  USER_ACCOUNT_DISABLED = 'USER_2003',

  // Order errors (3xxx)
  ORDER_NOT_FOUND = 'ORDER_3001',
  ORDER_ALREADY_CANCELLED = 'ORDER_3002',
  ORDER_INSUFFICIENT_STOCK = 'ORDER_3003',

  // Payment errors (4xxx)
  PAYMENT_FAILED = 'PAYMENT_4001',
  PAYMENT_REFUND_EXPIRED = 'PAYMENT_4002',

  // System errors (9xxx)
  INTERNAL_ERROR = 'SYS_9001',
  SERVICE_UNAVAILABLE = 'SYS_9002',
  RATE_LIMIT_EXCEEDED = 'SYS_9003',
}

export {
  DomainException,
  ResourceNotFoundException,
  BusinessRuleViolationException,
  DuplicateResourceException,
  InsufficientPermissionException,
  ErrorCode,
  type ErrorResponse,
  type ValidationErrorResponse,
};
