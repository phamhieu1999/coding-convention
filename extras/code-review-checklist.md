# ✅ Code Review Checklist

Checklist dành cho reviewer khi review Pull Request. Đảm bảo code chất lượng, bảo mật, và performance.

---

## 1. Correctness — Code có đúng logic không?

- [ ] Code giải quyết đúng vấn đề mô tả trong ticket/PR
- [ ] Edge cases được xử lý (null, empty, undefined, 0, negative)
- [ ] Error handling đầy đủ (try/catch, error propagation)
- [ ] Không có off-by-one errors
- [ ] Race conditions được xem xét (concurrent access)
- [ ] Idempotent nếu cần (retry-safe)

---

## 2. Clean Code — Code có dễ đọc không?

- [ ] Tên biến/hàm/class rõ ràng, mô tả đúng ý nghĩa
- [ ] Hàm < 30 dòng, làm đúng 1 việc (SRP)
- [ ] Không có magic numbers/strings → dùng constants
- [ ] Không có dead code, commented-out code
- [ ] Không lặp code (DRY) → extract helper/utility
- [ ] Consistent coding style (formatting, naming convention)
- [ ] Comments giải thích WHY, không phải WHAT

---

## 3. Architecture — Thiết kế đúng chuẩn không?

- [ ] Đúng layer: Controller → Service → Repository
- [ ] Controller thin — không chứa business logic
- [ ] Service chứa business logic, không import HTTP concepts
- [ ] Không có circular dependencies
- [ ] Dùng Dependency Injection đúng cách
- [ ] DTOs cho input validation, Entities cho database
- [ ] Tuân thủ SOLID principles

---

## 4. Security — Có lỗ hổng bảo mật không?

- [ ] Input validation (class-validator, DTO whitelist)
- [ ] Không log sensitive data (password, token, PII)
- [ ] SQL/NoSQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize output)
- [ ] Authentication check trên protected routes
- [ ] Authorization check (RBAC, resource ownership)
- [ ] Rate limiting trên sensitive endpoints
- [ ] Không hardcode secrets (dùng environment variables)
- [ ] File upload validation (size, type, extension)

---

## 5. Performance — Có bottleneck không?

- [ ] Không có N+1 query → dùng relations/joins
- [ ] Chỉ SELECT fields cần thiết (không SELECT *)
- [ ] Có index cho WHERE/ORDER BY columns
- [ ] Heavy tasks → delegated to queue
- [ ] Pagination cho list endpoints
- [ ] Caching phù hợp (Redis, in-memory)
- [ ] Không block event loop (large loops, sync I/O)
- [ ] Connection pool configuration hợp lý

---

## 6. Testing — Test có đủ không?

- [ ] Unit tests cho business logic mới
- [ ] Edge case tests (empty, null, boundary values)
- [ ] Error case tests (not found, validation fail)
- [ ] Integration tests cho DB queries (nếu cần)
- [ ] Tests pass locally trước khi push
- [ ] Test names mô tả rõ scenario + expected result
- [ ] Không có flaky tests (test kết quả nhất quán)

---

## 7. Database — Schema change an toàn?

- [ ] Migration reversible (có down/rollback)
- [ ] Zero-downtime migration (không DROP column trực tiếp)
- [ ] Index được thêm cho mới queries
- [ ] Column naming theo convention (snake_case)
- [ ] Foreign key constraints đúng
- [ ] Migration tested trên staging trước production

---

## 8. API — Endpoint chuẩn RESTful?

- [ ] URL naming: plural nouns, no verbs
- [ ] HTTP methods đúng (GET, POST, PUT, PATCH, DELETE)
- [ ] Response format consistent (`{ success, data, meta }`)
- [ ] Đúng HTTP status codes (201 create, 204 delete, 404 not found)
- [ ] Pagination cho list endpoints
- [ ] Swagger/OpenAPI documentation updated
- [ ] Breaking changes → new version hoặc deprecation plan

---

## 9. Deployment — Sẵn sàng deploy?

- [ ] Environment variables documented trong `.env.example`
- [ ] Database migration included (nếu schema change)
- [ ] Backward compatible (không break existing clients)
- [ ] Feature flag nếu feature chưa hoàn chỉnh
- [ ] Monitoring/alerting cho new features
- [ ] Rollback plan rõ ràng

---

## Quick Review Summary

Sau khi review, để comment tóm tắt:

```markdown
## Review Summary

**Status**: ✅ Approved / 🔄 Changes Requested / ❌ Rejected

### What I liked
- Clean separation of concerns
- Good error handling

### Issues Found
- [ ] Missing validation for `quantity` field (must be > 0)
- [ ] N+1 query in `getOrderWithItems`

### Suggestions (non-blocking)
- Consider adding cache for `getPopularProducts`
- Could extract `calculateDiscount` to a utility function
```

---

> 💡 **Tip**: Reviewer nên review trong < 30 phút. Nếu PR quá lớn → yêu cầu tách thành smaller PRs.
