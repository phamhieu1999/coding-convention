/**
 * ============================================
 * API DESIGN #2: HTTP STATUS CODES
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng đúng status code — client dựa vào đây để xử lý
 * 2. 2xx = Success, 4xx = Client error, 5xx = Server error
 * 3. Không trả 200 cho mọi response rồi đặt error trong body
 * 4. Mỗi status code có ý nghĩa rõ ràng — dùng đúng ngữ cảnh
 */

// ═══════════════════════════════════════════
// Rule 2.1: KHÔNG dùng 200 cho mọi response
// ═══════════════════════════════════════════

// ❌ BAD: Luôn trả 200, error nằm trong body
/*
// POST /api/v1/users — Create user
// Response: 200 OK
{
  "success": false,
  "error": "Email already exists"
}

// GET /api/v1/users/999
// Response: 200 OK
{
  "success": false,
  "error": "User not found"
}
*/

// ✅ GOOD: Status code đúng ngữ nghĩa
/*
// POST /api/v1/users — Create user
// Response: 409 Conflict
{
  "success": false,
  "error": { "code": "USER_EMAIL_TAKEN", "message": "Email already exists" }
}

// GET /api/v1/users/999
// Response: 404 Not Found
{
  "success": false,
  "error": { "code": "USER_NOT_FOUND", "message": "User not found" }
}
*/

// ═══════════════════════════════════════════
// Rule 2.2: Success Status Codes (2xx)
// ═══════════════════════════════════════════

const SUCCESS_STATUS = {
  200: {
    name: 'OK',
    when: 'GET thành công, PATCH/PUT update thành công',
    examples: [
      'GET /users/123 → 200 + user data',
      'PATCH /users/123 → 200 + updated user',
    ],
  },

  201: {
    name: 'Created',
    when: 'POST tạo resource mới thành công',
    examples: [
      'POST /users → 201 + created user + Location header',
      'POST /orders → 201 + created order',
    ],
    note: 'Nên trả Location header: Location: /api/v1/users/123',
  },

  204: {
    name: 'No Content',
    when: 'DELETE thành công, hoặc action không cần response body',
    examples: [
      'DELETE /users/123 → 204 (no body)',
      'POST /users/123/deactivate → 204',
      'PUT /settings → 204 (update thành công, không cần trả gì)',
    ],
  },
};

// ═══════════════════════════════════════════
// Rule 2.3: Client Error Status Codes (4xx)
// ═══════════════════════════════════════════

const CLIENT_ERROR_STATUS = {
  400: {
    name: 'Bad Request',
    when: 'Request format sai, malformed JSON, thiếu required fields',
    examples: [
      'POST /users { invalid json } → 400',
      'POST /users { } → 400 (thiếu required fields)',
      'GET /users?page=-1 → 400 (invalid query param)',
    ],
  },

  401: {
    name: 'Unauthorized',
    when: 'Chưa authenticate — thiếu hoặc sai token',
    examples: [
      'GET /profile (no token) → 401',
      'GET /profile (expired token) → 401',
    ],
    note: 'KHÔNG phải "không có quyền" — đó là 403',
  },

  403: {
    name: 'Forbidden',
    when: 'Đã authenticate nhưng KHÔNG ĐỦ QUYỀN',
    examples: [
      'DELETE /users/456 (role=user, not admin) → 403',
      'GET /admin/dashboard (role=user) → 403',
    ],
    note: 'Client đã login, server biết là ai, nhưng từ chối',
  },

  404: {
    name: 'Not Found',
    when: 'Resource không tồn tại',
    examples: [
      'GET /users/999 → 404',
      'PATCH /orders/999 → 404',
    ],
  },

  409: {
    name: 'Conflict',
    when: 'Conflict với state hiện tại — duplicate, version conflict',
    examples: [
      'POST /users { email: "taken@mail.com" } → 409',
      'POST /orders/123/cancel (already cancelled) → 409',
      'PUT /products/123 (optimistic lock version mismatch) → 409',
    ],
  },

  422: {
    name: 'Unprocessable Entity',
    when: 'Business validation fail — request format đúng nhưng logic sai',
    examples: [
      'POST /orders { items: [] } → 422 (empty cart)',
      'POST /transfer { amount: -100 } → 422 (negative amount)',
      'POST /orders/123/ship (not yet paid) → 422',
    ],
    note: '400 = format sai, 422 = format đúng nhưng business rule fail',
  },

  429: {
    name: 'Too Many Requests',
    when: 'Rate limit exceeded',
    examples: [
      'Quá 100 requests/minute → 429',
    ],
    note: 'Nên trả Retry-After header',
  },
};

// ═══════════════════════════════════════════
// Rule 2.4: Server Error Status Codes (5xx)
// ═══════════════════════════════════════════

const SERVER_ERROR_STATUS = {
  500: {
    name: 'Internal Server Error',
    when: 'Server gặp lỗi không xử lý được — bug, crash',
    note: 'KHÔNG expose chi tiết lỗi cho client trong production',
  },
  502: {
    name: 'Bad Gateway',
    when: 'Upstream service trả response invalid',
  },
  503: {
    name: 'Service Unavailable',
    when: 'Server đang bảo trì hoặc quá tải',
    note: 'Nên trả Retry-After header',
  },
  504: {
    name: 'Gateway Timeout',
    when: 'Upstream service không trả response trong timeout',
  },
};

// ═══════════════════════════════════════════
// Rule 2.5: Thực tế trong NestJS
// ═══════════════════════════════════════════

// ❌ BAD: Status code sai ngữ cảnh
/*
@Post()
async create(@Body() dto: CreateUserDto) {
  const user = await this.userService.create(dto);
  return user; // 200 OK — nhưng nên là 201 Created!
}

@Delete(':id')
async remove(@Param('id') id: string) {
  await this.userService.delete(id);
  return { message: 'Deleted' }; // 200 + body — nên là 204 No Content
}
*/

// ✅ GOOD: Status code đúng
/*
@Post()
@HttpCode(HttpStatus.CREATED) // 201
async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
  const user = await this.userService.create(dto);
  return UserResponseDto.fromEntity(user);
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT) // 204
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
  await this.userService.delete(id);
  // Không trả body
}

@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
): Promise<UserResponseDto> {
  // Tự động 200 OK
  const user = await this.userService.update(id, dto);
  return UserResponseDto.fromEntity(user);
}
*/

// ═══════════════════════════════════════════
// Quick Reference Table
// ═══════════════════════════════════════════

/*
┌──────────┬──────────────────────┬─────────────────────────────┐
│  Method  │ Success Status       │ Common Errors               │
├──────────┼──────────────────────┼─────────────────────────────┤
│ GET      │ 200 OK               │ 404 Not Found               │
│ POST     │ 201 Created          │ 400/422 Validation, 409 Dup │
│ PATCH    │ 200 OK               │ 404 Not Found, 422 Invalid  │
│ PUT      │ 200 OK / 204         │ 404 Not Found, 409 Conflict │
│ DELETE   │ 204 No Content       │ 404 Not Found               │
└──────────┴──────────────────────┴─────────────────────────────┘
*/

export { SUCCESS_STATUS, CLIENT_ERROR_STATUS, SERVER_ERROR_STATUS };
