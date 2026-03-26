# 📖 Coding Convention — TypeScript Best Practices

Bộ tài liệu coding convention toàn diện cho TypeScript/NestJS — **85 files** bao gồm Clean Code, Design Patterns, NestJS, API, Security, Database, Performance, Testing, DevOps và nhiều chủ đề nâng cao.

> Mỗi file là một module độc lập với format ❌ BAD vs ✅ GOOD. Có thể chạy `ts-node` để xem kết quả.

---

## 📑 Mục lục

- [📂 Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [🧹 Clean Code — 18 Quy Tắc](#-clean-code--18-quy-tắc)
- [🏗️ Design Patterns — 17 Patterns](#️-design-patterns--17-patterns)
- [🔧 NestJS Conventions — 7 Best Practices](#-nestjs-conventions--7-best-practices)
- [🌐 API Design — 5 Quy Chuẩn](#-api-design--5-quy-chuẩn)
- [🔒 Security — 5 Best Practices](#-security--5-best-practices)
- [🗄️ Database Conventions — 4 Best Practices](#️-database-conventions--4-best-practices)
- [⚡ Performance — 4 Best Practices](#-performance--4-best-practices)
- [🧪 Testing Advanced — 4 Patterns](#-testing-advanced--4-patterns)
- [🚢 DevOps — 5 Files](#-devops--5-files)
- [📦 Extras — 16 Files](#-extras--16-files)
- [🚀 Cách sử dụng](#-cách-sử-dụng)
- [📊 Tổng quan nhanh](#-tổng-quan-nhanh)

---

## 📂 Cấu trúc thư mục

```
coding-convention/
├── clean-code/                  # 18 quy tắc viết code sạch
│   ├── 01-naming.ts
│   ├── 02-functions.ts
│   ├── 03-dry.ts
│   ├── 04-error-handling.ts
│   ├── 05-solid.ts
│   ├── 06-comments.ts
│   ├── 07-formatting.ts
│   ├── 08-magic-numbers.ts
│   ├── 09-testing.ts
│   ├── 10-async-performance.ts
│   ├── 11-immutability.ts
│   ├── 12-encapsulation.ts
│   ├── 13-dependency-injection.ts
│   ├── 14-guard-clauses.ts
│   ├── 15-type-safety.ts
│   ├── 16-collections.ts
│   ├── 17-defensive-programming.ts
│   └── 18-code-smells.ts
│
├── design-patterns/             # 17 design patterns
│   ├── creational/              # 5 Creational
│   │   ├── singleton.ts
│   │   ├── factory-method.ts
│   │   ├── abstract-factory.ts
│   │   ├── builder.ts
│   │   └── prototype.ts
│   ├── structural/              # 6 Structural
│   │   ├── adapter.ts
│   │   ├── bridge.ts
│   │   ├── composite.ts
│   │   ├── decorator.ts
│   │   ├── facade.ts
│   │   └── proxy.ts
│   └── behavioral/              # 6 Behavioral
│       ├── chain-of-responsibility.ts
│       ├── command.ts
│       ├── observer.ts
│       ├── strategy.ts
│       ├── template-method.ts
│       └── state.ts
│
├── nestjs-conventions/          # 7 NestJS best practices
│   ├── 01-module-structure.ts
│   ├── 02-dependency-injection.ts
│   ├── 03-exception-filters.ts
│   ├── 04-pipes-validation.ts
│   ├── 05-interceptors.ts
│   ├── 06-guards.ts
│   └── 07-config-management.ts
│
├── api-design/                  # 5 API design conventions
│   ├── 01-restful-naming.ts
│   ├── 02-response-format.ts
│   ├── 03-pagination.ts
│   ├── 04-versioning.ts
│   └── 05-error-responses.ts
│
├── security/                    # 5 security best practices
│   ├── 01-input-validation.ts
│   ├── 02-authentication.ts
│   ├── 03-authorization.ts
│   ├── 04-data-sanitization.ts
│   └── 05-rate-limiting.ts
│
├── database-conventions/        # 4 database best practices
│   ├── 01-naming-conventions.ts
│   ├── 02-migration-strategy.ts
│   ├── 03-query-optimization.ts
│   └── 04-transaction-patterns.ts
│
├── performance/                 # 4 performance best practices
│   ├── 01-caching-strategies.ts
│   ├── 02-queue-patterns.ts
│   ├── 03-database-pooling.ts
│   └── 04-memory-management.ts
│
├── testing-advanced/            # 4 advanced testing patterns
│   ├── 01-unit-test-patterns.ts
│   ├── 02-integration-test.ts
│   ├── 03-e2e-test.ts
│   └── 04-test-fixtures.ts
│
├── devops/                      # 5 DevOps & deployment
│   ├── docker-conventions.md
│   ├── ci-cd-pipeline.md
│   ├── deployment-strategies.md
│   ├── environment-setup.md
│   └── monitoring-alerts.md
│
├── extras/                      # 16 standalone conventions
│   ├── git-conventions.md
│   ├── logging-monitoring.ts
│   ├── error-handling-strategy.ts
│   ├── code-review-checklist.md
│   ├── api-documentation.ts
│   ├── event-driven-patterns.ts
│   ├── microservice-patterns.ts
│   ├── websocket-conventions.ts
│   ├── database-seeding.ts
│   ├── file-upload-patterns.ts
│   ├── internationalization.ts
│   ├── graphql-conventions.ts
│   ├── pagination-patterns.ts
│   ├── soft-delete-patterns.ts
│   ├── multi-tenancy.ts
│   └── scheduling-cron.ts
│
├── tsconfig.json
├── package.json
└── README.md                    # ← Bạn đang đây
```

---

## 🧹 Clean Code — 18 Quy Tắc

| # | Quy tắc | File | Nội dung chính |
|---|---------|------|----------------|
| 01 | [**Naming**](clean-code/01-naming.ts) | Đặt tên | Biến, hàm, class, boolean, constants |
| 02 | [**Functions**](clean-code/02-functions.ts) | Viết hàm | < 30 dòng, SRP, ít params |
| 03 | [**DRY**](clean-code/03-dry.ts) | Không lặp | Extract function, constants |
| 04 | [**Error Handling**](clean-code/04-error-handling.ts) | Xử lý lỗi | Custom errors, error boundaries |
| 05 | [**SOLID**](clean-code/05-solid.ts) | SOLID | SRP, OCP, LSP, ISP, DIP |
| 06 | [**Comments**](clean-code/06-comments.ts) | Comments | WHY not WHAT, JSDoc |
| 07 | [**Formatting**](clean-code/07-formatting.ts) | Formatting | Consistent style, ESLint/Prettier |
| 08 | [**Magic Numbers**](clean-code/08-magic-numbers.ts) | Magic numbers | Named constants, enums |
| 09 | [**Testing**](clean-code/09-testing.ts) | Testing | Unit test basics, naming |
| 10 | [**Async Performance**](clean-code/10-async-performance.ts) | Async | Promise.all, avoid blocking |
| 11 | [**Immutability**](clean-code/11-immutability.ts) | Immutable | Readonly, spread operator |
| 12 | [**Encapsulation**](clean-code/12-encapsulation.ts) | Đóng gói | Private, getters/setters |
| 13 | [**Dependency Injection**](clean-code/13-dependency-injection.ts) | DI | Constructor injection |
| 14 | [**Guard Clauses**](clean-code/14-guard-clauses.ts) | Guard | Early return, fail fast |
| 15 | [**Type Safety**](clean-code/15-type-safety.ts) | Type-safe | Discriminated unions, generics |
| 16 | [**Collections**](clean-code/16-collections.ts) | Collections | Map, Set, reduce |
| 17 | [**Defensive Programming**](clean-code/17-defensive-programming.ts) | Phòng thủ | Null checks, assertions |
| 18 | [**Code Smells**](clean-code/18-code-smells.ts) | Code smells | God class, long method |

---

## 🏗️ Design Patterns — 17 Patterns

### Creational (5)

| Pattern | File | Nội dung chính |
|---------|------|----------------|
| [**Singleton**](design-patterns/creational/singleton.ts) | Single instance | Module-level singleton, NestJS provider |
| [**Factory Method**](design-patterns/creational/factory-method.ts) | Tạo object | PaymentProcessor factory |
| [**Abstract Factory**](design-patterns/creational/abstract-factory.ts) | Family of objects | UI component factory |
| [**Builder**](design-patterns/creational/builder.ts) | Complex construction | QueryBuilder, fluent API |
| [**Prototype**](design-patterns/creational/prototype.ts) | Clone objects | Deep clone, template |

### Structural (6)

| Pattern | File | Nội dung chính |
|---------|------|----------------|
| [**Adapter**](design-patterns/structural/adapter.ts) | Interface convert | Payment gateway adapter |
| [**Bridge**](design-patterns/structural/bridge.ts) | Abstraction ↔ Impl | Notification bridge |
| [**Composite**](design-patterns/structural/composite.ts) | Tree structure | Menu, permission tree |
| [**Decorator**](design-patterns/structural/decorator.ts) | Extend behavior | Logger, cache decorator |
| [**Facade**](design-patterns/structural/facade.ts) | Simplified API | Order facade |
| [**Proxy**](design-patterns/structural/proxy.ts) | Access control | Cache proxy, lazy loading |

### Behavioral (6)

| Pattern | File | Nội dung chính |
|---------|------|----------------|
| [**Chain of Responsibility**](design-patterns/behavioral/chain-of-responsibility.ts) | Handler chain | Middleware, approval flow |
| [**Command**](design-patterns/behavioral/command.ts) | Encapsulate request | Undo/redo, queue |
| [**Observer**](design-patterns/behavioral/observer.ts) | Pub/Sub | Event emitter |
| [**Strategy**](design-patterns/behavioral/strategy.ts) | Algorithm swap | Pricing, sorting |
| [**Template Method**](design-patterns/behavioral/template-method.ts) | Algorithm skeleton | Report generator |
| [**State**](design-patterns/behavioral/state.ts) | State machine | Order status |

---

## 🔧 NestJS Conventions — 7 Best Practices

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**Module Structure**](nestjs-conventions/01-module-structure.ts) | Tổ chức module | Feature modules, shared module, barrel exports |
| 02 | [**Dependency Injection**](nestjs-conventions/02-dependency-injection.ts) | DI | Custom providers, injection tokens, scope |
| 03 | [**Exception Filters**](nestjs-conventions/03-exception-filters.ts) | Lọc lỗi | Global filter, domain exceptions, error mapping |
| 04 | [**Pipes & Validation**](nestjs-conventions/04-pipes-validation.ts) | Validation | class-validator, custom pipes, transform |
| 05 | [**Interceptors**](nestjs-conventions/05-interceptors.ts) | Interceptors | Logging, transform, cache, timeout |
| 06 | [**Guards**](nestjs-conventions/06-guards.ts) | Auth guards | JWT guard, roles guard, composite |
| 07 | [**Config Management**](nestjs-conventions/07-config-management.ts) | Config | ConfigModule, validation, typed config |

---

## 🌐 API Design — 5 Quy Chuẩn

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**RESTful Naming**](api-design/01-restful-naming.ts) | URL design | Plural nouns, nested resources, query params |
| 02 | [**Response Format**](api-design/02-response-format.ts) | Response | Envelope pattern, consistent structure |
| 03 | [**Pagination**](api-design/03-pagination.ts) | Phân trang | Offset, cursor, meta info |
| 04 | [**Versioning**](api-design/04-versioning.ts) | API version | URL, header, media type versioning |
| 05 | [**Error Responses**](api-design/05-error-responses.ts) | Error format | Error codes, validation errors, HTTP status |

---

## 🔒 Security — 5 Best Practices

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**Input Validation**](security/01-input-validation.ts) | Validate input | Whitelist, DTO decorators, nested validation |
| 02 | [**Authentication**](security/02-authentication.ts) | JWT & Auth | Password hashing, JWT strategy, refresh token |
| 03 | [**Authorization**](security/03-authorization.ts) | Access control | RBAC, role hierarchy, resource ownership |
| 04 | [**Data Sanitization**](security/04-data-sanitization.ts) | Prevent attacks | SQL/NoSQL injection, XSS, path traversal |
| 05 | [**Rate Limiting**](security/05-rate-limiting.ts) | Throttling | Per-endpoint limits, sliding window (Redis) |

---

## 🗄️ Database Conventions — 4 Best Practices

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**Naming Conventions**](database-conventions/01-naming-conventions.ts) | DB naming | Table/column/FK/index naming |
| 02 | [**Migration Strategy**](database-conventions/02-migration-strategy.ts) | Schema changes | Reversible migrations, zero-downtime |
| 03 | [**Query Optimization**](database-conventions/03-query-optimization.ts) | Performance | N+1 fix, index strategy, EXPLAIN |
| 04 | [**Transaction Patterns**](database-conventions/04-transaction-patterns.ts) | Data integrity | Isolation levels, optimistic locking, saga |

---

## ⚡ Performance — 4 Best Practices

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**Caching Strategies**](performance/01-caching-strategies.ts) | Cache | Cache-aside, invalidation, multi-layer |
| 02 | [**Queue Patterns**](performance/02-queue-patterns.ts) | Job queue | BullMQ, retry, dead-letter queue |
| 03 | [**Database Pooling**](performance/03-database-pooling.ts) | Connection pool | Pool sizing, health check, read replica |
| 04 | [**Memory Management**](performance/04-memory-management.ts) | Memory | Stream processing, WeakRef, leak detection |

---

## 🧪 Testing Advanced — 4 Patterns

| # | Convention | File | Nội dung chính |
|---|-----------|------|----------------|
| 01 | [**Unit Test Patterns**](testing-advanced/01-unit-test-patterns.ts) | Unit tests | AAA pattern, mock/stub/spy |
| 02 | [**Integration Test**](testing-advanced/02-integration-test.ts) | Integration | Real DB, transaction rollback, containers |
| 03 | [**E2E Test**](testing-advanced/03-e2e-test.ts) | End-to-end | Supertest, CRUD lifecycle, auth flow |
| 04 | [**Test Fixtures**](testing-advanced/04-test-fixtures.ts) | Test data | Factory/Builder patterns, seeders |

---

## 🚢 DevOps — 5 Files

| File | Nội dung chính |
|------|----------------|
| [**docker-conventions.md**](devops/docker-conventions.md) | Multi-stage Dockerfile, .dockerignore, layer caching, docker-compose dev/prod |
| [**ci-cd-pipeline.md**](devops/ci-cd-pipeline.md) | GitHub Actions CI/CD, lint/test/build/docker, staging → production |
| [**deployment-strategies.md**](devops/deployment-strategies.md) | Rolling update, blue-green, canary, feature flags, rollback |
| [**environment-setup.md**](devops/environment-setup.md) | Tools, .env template, VS Code config, npm scripts, troubleshooting |
| [**monitoring-alerts.md**](devops/monitoring-alerts.md) | Prometheus, Grafana, alert rules (P1/P2/P3), incident runbook |

---

## 📦 Extras — 16 Files

| File | Nội dung chính |
|------|----------------|
| [**git-conventions.md**](extras/git-conventions.md) | Conventional commits, branch naming, PR template, merge strategy |
| [**logging-monitoring.ts**](extras/logging-monitoring.ts) | Structured logging, correlation ID, log levels, health check, metrics |
| [**error-handling-strategy.ts**](extras/error-handling-strategy.ts) | Error taxonomy, error codes, circuit breaker, retry backoff |
| [**code-review-checklist.md**](extras/code-review-checklist.md) | 9-category review checklist |
| [**api-documentation.ts**](extras/api-documentation.ts) | Swagger/OpenAPI setup, DTO decorators, error docs |
| [**event-driven-patterns.ts**](extras/event-driven-patterns.ts) | EventEmitter, CQRS, event sourcing, transactional outbox |
| [**microservice-patterns.ts**](extras/microservice-patterns.ts) | Service communication, API gateway, bulkhead |
| [**websocket-conventions.ts**](extras/websocket-conventions.ts) | NestJS gateway, rooms, push notifications, reconnection |
| [**database-seeding.ts**](extras/database-seeding.ts) | Seed runner, typed factories, env-specific config |
| [**file-upload-patterns.ts**](extras/file-upload-patterns.ts) | Validation, storage abstraction (local/S3), presigned URL |
| [**internationalization.ts**](extras/internationalization.ts) | Translation files, interpolation, locale detection, formatting |
| [**graphql-conventions.ts**](extras/graphql-conventions.ts) | Code-first schema, resolvers, DataLoader, subscriptions |
| [**pagination-patterns.ts**](extras/pagination-patterns.ts) | Offset, cursor-based, keyset pagination, index strategy |
| [**soft-delete-patterns.ts**](extras/soft-delete-patterns.ts) | Soft delete, restore, partial unique index, cascade, cleanup |
| [**multi-tenancy.ts**](extras/multi-tenancy.ts) | Row-level, schema-level, DB-level, tenant middleware |
| [**scheduling-cron.ts**](extras/scheduling-cron.ts) | NestJS @Cron, distributed lock, job monitoring, graceful shutdown |

---

## 🚀 Cách sử dụng

### Setup

```bash
# Cài dependencies (để resolve @types/node)
npm install

# Chạy bất kỳ file nào
npx ts-node clean-code/01-naming.ts
npx ts-node performance/01-caching-strategies.ts
```

### Gợi ý học tập

1. **Beginner** → `clean-code/01-naming` đến `08-magic-numbers`
2. **Intermediate** → `09-testing` đến `18-code-smells` + Design Patterns
3. **NestJS** → `nestjs-conventions/` — dành cho dev làm việc với NestJS
4. **API** → `api-design/` — thiết kế API chuẩn RESTful
5. **Security** → `security/` — bảo mật ứng dụng
6. **Performance** → `performance/` — caching, queue, pooling, memory
7. **Testing** → `testing-advanced/` — unit, integration, e2e, fixtures
8. **DevOps** → `devops/` — Docker, CI/CD, deployment, monitoring
9. **Advanced** → `extras/` — GraphQL, microservice, WebSocket, multi-tenancy

### Format mỗi file

```
1. Header — Tên quy tắc + danh sách nguyên tắc
2. ❌ BAD — Code vi phạm quy tắc (anti-pattern)
3. ✅ GOOD — Code đúng chuẩn (best practice)
4. Ví dụ thực tế — E-commerce, Payment, Order System...
5. Export — Các symbols có thể import/reuse
```

---

## 📊 Tổng quan nhanh

| Chủ đề | Số lượng | Ngôn ngữ |
|--------|----------|----------|
| Clean Code Rules | 18 files | TypeScript |
| Design Patterns | 17 files | TypeScript |
| NestJS Conventions | 7 files | TypeScript |
| API Design | 5 files | TypeScript |
| Security | 5 files | TypeScript |
| Database Conventions | 4 files | TypeScript |
| Performance | 4 files | TypeScript |
| Testing Advanced | 4 files | TypeScript |
| DevOps | 5 files | Markdown |
| Extras | 16 files | Mixed |
| **Tổng cộng** | **85 files** | — |

### Quy tắc vàng

- ✅ **Tên rõ ràng** — Code tự giải thích
- ✅ **Hàm < 30 dòng** — Mỗi hàm một việc
- ✅ **DRY** — Không lặp logic
- ✅ **SOLID** — Thiết kế linh hoạt
- ✅ **Immutable** — Không mutate object gốc
- ✅ **Type-safe** — Tận dụng TypeScript
- ✅ **Test-driven** — Viết test trước khi code
- ✅ **Secure by default** — Validate input, sanitize output

---

> 💡 **Đóng góp**: Mỗi file đều self-contained. Thêm file mới theo cùng format ❌ BAD vs ✅ GOOD.
