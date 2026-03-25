/**
 * ============================================
 * API DESIGN #4: RESPONSE FORMAT
 * ============================================
 *
 * Nguyên tắc:
 * 1. Response format THỐNG NHẤT cho toàn bộ API
 * 2. Client luôn biết cách parse response
 * 3. Success response: { success, data, meta? }
 * 4. Error response: { success, error: { code, message, details? } }
 * 5. Không trộn lẫn format giữa các endpoints
 */

// ═══════════════════════════════════════════
// Rule 4.1: Response Format Không Thống Nhất
// ═══════════════════════════════════════════

// ❌ BAD: Mỗi endpoint trả format khác nhau
/*
// GET /users → trả array trực tiếp
[{ id: 1, name: "John" }, { id: 2, name: "Jane" }]

// GET /users/1 → trả object trực tiếp
{ id: 1, name: "John", email: "john@mail.com" }

// POST /users → trả trong "result"
{ result: { id: 3, name: "Bob" }, status: "ok" }

// GET /orders → trả trong "data" nhưng format khác
{ data: [...], count: 50, pages: 5 }

// Error → không có format chuẩn
{ error: "Not found" }
{ message: "Invalid input", errors: [...] }
{ success: false, msg: "Unauthorized" }
*/

// ═══════════════════════════════════════════
// Rule 4.2: Standard Response Envelope
// ═══════════════════════════════════════════

// ✅ GOOD: Thống nhất format cho toàn bộ API

// ─── Success: Single Item ───
interface SingleItemResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

// Ví dụ: GET /api/v1/users/123
const singleItemExample: SingleItemResponse<{
  id: string;
  email: string;
  name: string;
}> = {
  success: true,
  data: {
    id: '123',
    email: 'john@example.com',
    name: 'John Doe',
  },
  timestamp: '2024-01-15T10:30:00Z',
};

// ─── Success: List (Paginated) ───
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ListResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
  timestamp: string;
}

// Ví dụ: GET /api/v1/users?page=2&limit=10
const listExample: ListResponse<{ id: string; email: string }> = {
  success: true,
  data: [
    { id: '1', email: 'john@example.com' },
    { id: '2', email: 'jane@example.com' },
  ],
  meta: {
    total: 150,
    page: 2,
    limit: 10,
    totalPages: 15,
    hasNextPage: true,
    hasPreviousPage: true,
  },
  timestamp: '2024-01-15T10:30:00Z',
};

// ─── Success: No Content ───
// HTTP 204 — Không có body

// ─── Success: Created ───
// HTTP 201 + SingleItemResponse + Location header

// ═══════════════════════════════════════════
// Rule 4.3: Error Response Format
// ═══════════════════════════════════════════

interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
  timestamp: string;
  path: string;
  requestId?: string;
}

// Ví dụ: 400 Validation Error
const validationErrorExample: ErrorResponse = {
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [
      { field: 'email', message: 'Email is required' },
      { field: 'age', message: 'Age must be between 1 and 150' },
      { field: 'password', message: 'Password must be at least 8 characters' },
    ],
  },
  timestamp: '2024-01-15T10:30:00Z',
  path: '/api/v1/users',
  requestId: 'req-abc123',
};

// Ví dụ: 404 Not Found
const notFoundErrorExample: ErrorResponse = {
  success: false,
  error: {
    code: 'USER_NOT_FOUND',
    message: 'User with id "999" not found',
  },
  timestamp: '2024-01-15T10:30:00Z',
  path: '/api/v1/users/999',
  requestId: 'req-def456',
};

// Ví dụ: 401 Unauthorized
const unauthorizedExample: ErrorResponse = {
  success: false,
  error: {
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'Access token has expired',
  },
  timestamp: '2024-01-15T10:30:00Z',
  path: '/api/v1/profile',
  requestId: 'req-ghi789',
};

// ═══════════════════════════════════════════
// Rule 4.4: Response Builder Helper
// ═══════════════════════════════════════════

// ✅ GOOD: Centralized response builder
class ApiResponse {
  static success<T>(data: T): SingleItemResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static list<T>(
    data: T[],
    meta: PaginationMeta,
  ): ListResponse<T> {
    return {
      success: true,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };
  }

  static error(
    code: string,
    message: string,
    path: string,
    details?: ErrorDetail[],
    requestId?: string,
  ): ErrorResponse {
    return {
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };
  }
}

// Sử dụng trong controller:
/*
@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.userService.findById(id);
  return ApiResponse.success(UserResponseDto.fromEntity(user));
}

@Get()
async findAll(@Query() query: PaginationDto) {
  const { data, meta } = await this.userService.findPaginated(query);
  return ApiResponse.list(
    data.map(UserResponseDto.fromEntity),
    meta,
  );
}
*/

// ═══════════════════════════════════════════
// Rule 4.5: Response Headers Convention
// ═══════════════════════════════════════════

/*
// Standard headers cho API responses:

// Rate limiting
X-RateLimit-Limit: 100        // Max requests per window
X-RateLimit-Remaining: 87     // Remaining requests
X-RateLimit-Reset: 1705312200 // Window reset timestamp

// Pagination (optional, thay cho body meta)
X-Total-Count: 150
X-Page: 2
X-Per-Page: 10

// Request tracing
X-Request-Id: req-abc123      // Correlation ID cho debugging

// Cache
Cache-Control: public, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

// Created resource location
Location: /api/v1/users/123   // Sau POST 201
*/

export {
  ApiResponse,
  singleItemExample,
  listExample,
  validationErrorExample,
  notFoundErrorExample,
  unauthorizedExample,
  type SingleItemResponse,
  type ListResponse,
  type ErrorResponse,
  type PaginationMeta,
};
