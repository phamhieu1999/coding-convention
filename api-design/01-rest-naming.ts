/**
 * ============================================
 * API DESIGN #1: REST NAMING CONVENTION
 * ============================================
 *
 * Nguyên tắc:
 * 1. URL dùng danh từ số nhiều (plural nouns)
 * 2. KHÔNG dùng verb trong URL — HTTP method đã thể hiện action
 * 3. Lowercase, dùng hyphen (-) thay underscore (_)
 * 4. Nested resources cho quan hệ cha-con
 * 5. Versioning trong URL path: /api/v1/
 * 6. Query params cho filter, sort, pagination
 */

// ═══════════════════════════════════════════
// Rule 1.1: Plural Nouns, No Verbs
// ═══════════════════════════════════════════

// ❌ BAD: Verb trong URL, inconsistent naming
const BAD_ROUTES = {
  'GET    /api/getUsers':           'Verb trong URL',
  'GET    /api/getUserById/123':    'Verb + camelCase',
  'POST   /api/createNewUser':      'Verb + camelCase',
  'POST   /api/user/delete/123':    'POST cho delete',
  'GET    /api/user':               'Singular noun',
  'PUT    /api/update_user/123':    'Verb + underscore',
  'GET    /api/users-list':         'Thừa -list',
  'GET    /api/getAllProducts':      'Verb + camelCase',
};

// ✅ GOOD: RESTful — resource + HTTP method
const GOOD_ROUTES = {
  'GET    /api/v1/users':           'List users',
  'GET    /api/v1/users/123':       'Get user by ID',
  'POST   /api/v1/users':           'Create user',
  'PATCH  /api/v1/users/123':       'Partial update user',
  'PUT    /api/v1/users/123':       'Full replace user',
  'DELETE /api/v1/users/123':       'Delete user',
};

// ═══════════════════════════════════════════
// Rule 1.2: Nested Resources
// ═══════════════════════════════════════════

// ❌ BAD: Flat routes cho related resources
const BAD_NESTED = {
  'GET /api/v1/getUserOrders?userId=123':  'Verb + query param',
  'GET /api/v1/orderItems?orderId=456':    'Flat structure',
};

// ✅ GOOD: Nested max 2 levels
const GOOD_NESTED = {
  'GET    /api/v1/users/123/orders':         'Orders of user 123',
  'GET    /api/v1/users/123/orders/456':     'Order 456 of user 123',
  'POST   /api/v1/users/123/orders':         'Create order for user 123',
  'GET    /api/v1/orders/456/items':          'Items of order 456',
  'POST   /api/v1/orders/456/items':          'Add item to order 456',
};

// ⚠️ Không nest quá 2 levels — khó đọc + maintain
// ❌ /api/v1/users/123/orders/456/items/789/reviews
// ✅ /api/v1/order-items/789/reviews

// ═══════════════════════════════════════════
// Rule 1.3: Actions (Non-CRUD Operations)
// ═══════════════════════════════════════════

// Khi operation KHÔNG map được sang CRUD → dùng verb endpoint

// ❌ BAD: Ép vào CRUD
const BAD_ACTIONS = {
  'PATCH /api/v1/users/123 { isActive: true }':  'Activate = update?',
  'POST  /api/v1/emails { userId: 123 }':        'Mơ hồ',
};

// ✅ GOOD: Action sub-resource
const GOOD_ACTIONS = {
  'POST   /api/v1/users/123/activate':    'Activate user',
  'POST   /api/v1/users/123/deactivate':  'Deactivate user',
  'POST   /api/v1/orders/456/cancel':     'Cancel order',
  'POST   /api/v1/orders/456/refund':     'Refund order',
  'POST   /api/v1/auth/login':            'Login',
  'POST   /api/v1/auth/logout':           'Logout',
  'POST   /api/v1/auth/refresh':          'Refresh token',
  'POST   /api/v1/reports/generate':      'Generate report',
};

// ═══════════════════════════════════════════
// Rule 1.4: Query Parameters
// ═══════════════════════════════════════════

// ❌ BAD: Filter/sort logic trong URL path
const BAD_QUERY = {
  'GET /api/v1/users/active':              'Filter trong path',
  'GET /api/v1/users/sort/name/asc':       'Sort trong path',
  'GET /api/v1/users/page/2/limit/20':     'Pagination trong path',
};

// ✅ GOOD: Query params cho filter, sort, pagination
const GOOD_QUERY = {
  // Filtering
  'GET /api/v1/users?status=active':                        'Filter by status',
  'GET /api/v1/users?role=admin&status=active':             'Multiple filters',
  'GET /api/v1/products?minPrice=100&maxPrice=500':         'Range filter',
  'GET /api/v1/orders?createdAfter=2024-01-01':             'Date filter',

  // Sorting
  'GET /api/v1/users?sortBy=createdAt&sortOrder=desc':      'Sort',
  'GET /api/v1/products?sort=-price,+name':                 'Multi-sort (-=desc)',

  // Pagination
  'GET /api/v1/users?page=2&limit=20':                      'Offset pagination',
  'GET /api/v1/users?cursor=abc123&limit=20':               'Cursor pagination',

  // Search
  'GET /api/v1/users?search=john':                          'Full-text search',
  'GET /api/v1/products?q=laptop&category=electronics':     'Search + filter',

  // Field selection
  'GET /api/v1/users?fields=id,email,name':                 'Sparse fieldsets',
};

// ═══════════════════════════════════════════
// Rule 1.5: URL Naming Convention
// ═══════════════════════════════════════════

// ❌ BAD
const BAD_NAMING = {
  '/api/v1/userProfiles':     'camelCase',
  '/api/v1/user_profiles':    'snake_case',
  '/api/v1/User-Profiles':    'PascalCase',
  '/api/v1/USER-PROFILES':    'UPPERCASE',
};

// ✅ GOOD: lowercase + kebab-case
const GOOD_NAMING = {
  '/api/v1/user-profiles':    'kebab-case ✓',
  '/api/v1/order-items':      'kebab-case ✓',
  '/api/v1/product-categories': 'kebab-case ✓',
  '/api/v1/payment-methods':  'kebab-case ✓',
};

export {
  BAD_ROUTES,
  GOOD_ROUTES,
  GOOD_NESTED,
  GOOD_ACTIONS,
  GOOD_QUERY,
  GOOD_NAMING,
};
