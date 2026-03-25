/**
 * ============================================
 * API DESIGN #5: API VERSIONING
 * ============================================
 *
 * Nguyên tắc:
 * 1. LUÔN version API từ đầu — thêm sau rất khó
 * 2. URL path versioning được khuyên dùng nhất: /api/v1/
 * 3. Deprecation strategy rõ ràng trước khi xóa version cũ
 * 4. Breaking change = new version, non-breaking = giữ version
 * 5. Support ít nhất 2 versions cùng lúc (N và N-1)
 */

// ═══════════════════════════════════════════
// Rule 5.1: Versioning Strategies
// ═══════════════════════════════════════════

// ─── Strategy 1: URL Path (Recommended) ───
// ✅ Dễ hiểu, dễ route, dễ test
const URL_PATH_VERSIONING = {
  'GET /api/v1/users':         'Version 1',
  'GET /api/v2/users':         'Version 2 — new response format',
  'POST /api/v1/orders':       'Version 1',
  'POST /api/v2/orders':       'Version 2 — new fields',
};

// NestJS setup:
/*
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  prefix: 'api/v',
  defaultVersion: '1',
});

// Controller
@Controller('users')
@Version('1')
export class UserV1Controller {
  @Get()
  findAll() { return 'V1 response'; }
}

@Controller('users')
@Version('2')
export class UserV2Controller {
  @Get()
  findAll() { return 'V2 response — new format'; }
}
*/

// ─── Strategy 2: Header Versioning ───
// Custom header: X-API-Version: 2
const HEADER_VERSIONING = {
  'GET /api/users (X-API-Version: 1)': 'Version 1',
  'GET /api/users (X-API-Version: 2)': 'Version 2',
};
// ⚠️ Khó test trong browser, khó share link

// ─── Strategy 3: Query Param ───
const QUERY_VERSIONING = {
  'GET /api/users?version=1': 'Version 1',
  'GET /api/users?version=2': 'Version 2',
};
// ⚠️ Dễ quên, pollute query params

// ─── Strategy 4: Media Type (Content Negotiation) ───
const MEDIA_TYPE_VERSIONING = {
  'Accept: application/vnd.myapp.v1+json': 'Version 1',
  'Accept: application/vnd.myapp.v2+json': 'Version 2',
};
// ⚠️ Phức tạp nhất, ít phổ biến

// ═══════════════════════════════════════════
// Rule 5.2: Breaking vs Non-Breaking Changes
// ═══════════════════════════════════════════

// ✅ NON-BREAKING (Giữ nguyên version):
const NON_BREAKING = {
  'Add optional field':      'POST /v1/users — thêm field "nickname" optional',
  'Add new endpoint':        'GET /v1/users/stats — endpoint mới',
  'Add response field':      'Response thêm field "avatarUrl"',
  'Bug fix':                 'Fix validation logic',
  'Performance improvement': 'Index, caching',
};

// 🚨 BREAKING (Cần new version):
const BREAKING = {
  'Remove field':            'Xóa "firstName" khỏi response',
  'Rename field':            '"name" → "fullName"',
  'Change type':             '"age: string" → "age: number"',
  'Change URL':              '/users/{id} → /accounts/{id}',
  'Change behavior':         'Đổi default sort order',
  'Remove endpoint':         'Xóa GET /users/search',
  'Change error format':     'Đổi error response structure',
  'Change auth mechanism':   'Basic Auth → Bearer Token',
};

// ═══════════════════════════════════════════
// Rule 5.3: Deprecation Strategy
// ═══════════════════════════════════════════

// ✅ GOOD: Deprecation lifecycle rõ ràng
/*
Timeline:
1. v2 Released    → v1 vẫn hoạt động, đánh dấu deprecated
2. +3 months      → v1 trả header cảnh báo
3. +6 months      → v1 trả 410 Gone (hoặc redirect đến v2)
4. +12 months     → v1 bị xóa hoàn toàn
*/

// Deprecation interceptor:
/*
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  private readonly deprecatedVersions: Record<string, {
    sunset: string;
    successor: string;
    message: string;
  }> = {
    '1': {
      sunset: '2025-06-01',
      successor: '2',
      message: 'API v1 is deprecated. Please migrate to v2.',
    },
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const version = request.version || '1';

    const deprecation = this.deprecatedVersions[version];
    if (deprecation) {
      response.setHeader('Deprecation', 'true');
      response.setHeader('Sunset', deprecation.sunset);
      response.setHeader('Link', `</api/v${deprecation.successor}>; rel="successor-version"`);
      response.setHeader('X-Deprecation-Notice', deprecation.message);
    }

    return next.handle();
  }
}
*/

// ═══════════════════════════════════════════
// Rule 5.4: Version Migration Guide
// ═══════════════════════════════════════════

// ✅ GOOD: Document changes giữa versions
/*
## Migration Guide: v1 → v2

### Breaking Changes

#### 1. User Response Format
```diff
 {
   "id": "123",
-  "firstName": "John",
-  "lastName": "Doe",
+  "name": {
+    "first": "John",
+    "last": "Doe",
+    "display": "John Doe"
+  },
   "email": "john@example.com",
-  "created_at": "2024-01-15",
+  "createdAt": "2024-01-15T10:30:00Z"
 }
```

#### 2. Pagination Format
```diff
 {
   "data": [...],
-  "total": 150,
-  "page": 2,
-  "perPage": 20
+  "meta": {
+    "total": 150,
+    "page": 2,
+    "limit": 20,
+    "totalPages": 8,
+    "hasNextPage": true
+  }
 }
```

#### 3. Error Format
```diff
 {
-  "error": "Not found",
-  "statusCode": 404
+  "success": false,
+  "error": {
+    "code": "USER_NOT_FOUND",
+    "message": "User with id '999' not found"
+  }
 }
```
*/

// ═══════════════════════════════════════════
// Rule 5.5: Multi-Version Controller Pattern
// ═══════════════════════════════════════════

// ✅ GOOD: Shared service, different DTOs per version
/*
// Shared business logic
@Injectable()
export class UserService {
  async findAll(filters: UserFilters): Promise<User[]> {
    // Core logic — version agnostic
  }
}

// V1 Controller — legacy format
@Controller({ path: 'users', version: '1' })
export class UserV1Controller {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Query() query: UserV1QueryDto): Promise<UserV1ResponseDto[]> {
    const users = await this.userService.findAll(query);
    return users.map(UserV1ResponseDto.fromEntity);
  }
}

// V2 Controller — new format
@Controller({ path: 'users', version: '2' })
export class UserV2Controller {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Query() query: UserV2QueryDto): Promise<PaginatedResponse<UserV2ResponseDto>> {
    const result = await this.userService.findPaginated(query);
    return {
      data: result.data.map(UserV2ResponseDto.fromEntity),
      meta: result.meta,
    };
  }
}
*/

// ═══════════════════════════════════════════
// Quick Reference
// ═══════════════════════════════════════════

/*
┌──────────────────────┬────────────────┬─────────────────────┬──────────────┐
│ Strategy             │ Difficulty     │ Cacheability        │ Recommended  │
├──────────────────────┼────────────────┼─────────────────────┼──────────────┤
│ URL Path (/v1/)      │ ⭐ Easy        │ ✅ Dễ cache          │ ✅ YES       │
│ Header               │ ⭐⭐ Medium    │ ⚠️ Vary header      │ Sometimes    │
│ Query Param          │ ⭐ Easy        │ ✅ Dễ cache          │ ❌ No        │
│ Media Type           │ ⭐⭐⭐ Hard    │ ⚠️ Phức tạp         │ ❌ No        │
└──────────────────────┴────────────────┴─────────────────────┴──────────────┘
*/

export {
  URL_PATH_VERSIONING,
  HEADER_VERSIONING,
  QUERY_VERSIONING,
  MEDIA_TYPE_VERSIONING,
  NON_BREAKING,
  BREAKING,
};
