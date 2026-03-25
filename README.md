# 📖 Coding Convention — TypeScript Best Practices

Bộ tài liệu coding convention toàn diện cho TypeScript/NestJS, bao gồm **18 quy tắc Clean Code** và **17 Design Patterns** với ví dụ thực tế so sánh ❌ BAD vs ✅ GOOD.

> Mỗi file là một module độc lập, có thể chạy bằng `ts-node` để xem kết quả.

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
│   ├── creational/              # 5 Creational Patterns
│   │   ├── singleton.ts
│   │   ├── factory-method.ts
│   │   ├── abstract-factory.ts
│   │   ├── builder.ts
│   │   └── prototype.ts
│   ├── structural/              # 6 Structural Patterns
│   │   ├── adapter.ts
│   │   ├── bridge.ts
│   │   ├── composite.ts
│   │   ├── decorator.ts
│   │   ├── facade.ts
│   │   └── proxy.ts
│   ├── behavioral/              # 6 Behavioral Patterns
│   │   ├── chain-of-responsibility.ts
│   │   ├── command.ts
│   │   ├── observer.ts
│   │   ├── state.ts
│   │   ├── strategy.ts
│   │   └── template-method.ts
│   └── README.md
│
└── README.md                    # ← Bạn đang đây
```

---

## 🧹 Clean Code — 18 Quy Tắc

### Nền tảng (Rules 1–5)

| # | Quy tắc | Mô tả | Nguyên tắc chính |
|---|---------|--------|------------------|
| 01 | [**Naming**](clean-code/01-naming.ts) | Đặt tên có ý nghĩa | Tên tự giải thích, động từ cho hàm, danh từ cho biến, boolean dùng `is/has/can`, constants dùng `UPPER_SNAKE_CASE` |
| 02 | [**Functions**](clean-code/02-functions.ts) | Hàm sạch | Mỗi hàm 1 việc, < 30 dòng, tối đa 3 tham số, không flag argument, early return, pure function |
| 03 | [**DRY**](clean-code/03-dry.ts) | Don't Repeat Yourself | Trích xuất logic lặp, dùng generics, centralized validators, tránh DRY quá mức |
| 04 | [**Error Handling**](clean-code/04-error-handling.ts) | Xử lý lỗi | Custom error classes, không nuốt lỗi, Result pattern, centralized error handler |
| 05 | [**SOLID**](clean-code/05-solid.ts) | SOLID Principles | SRP, OCP (Strategy pattern), ISP (interface nhỏ), DIP (depend on abstractions) |

### Code Style (Rules 6–8)

| # | Quy tắc | Mô tả | Nguyên tắc chính |
|---|---------|--------|------------------|
| 06 | [**Comments**](clean-code/06-comments.ts) | Comments & Documentation | Comment WHY không phải WHAT, xóa code bị comment, JSDoc cho public API, TODO có context |
| 07 | [**Formatting**](clean-code/07-formatting.ts) | Code Formatting | Import ordering, vertical spacing, newspaper rule, consistent brace style |
| 08 | [**Magic Numbers**](clean-code/08-magic-numbers.ts) | Tránh Magic Numbers | Named constants, Enum cho tập cố định, centralized config object |

### Testing & Performance (Rules 9–10)

| # | Quy tắc | Mô tả | Nguyên tắc chính |
|---|---------|--------|------------------|
| 09 | [**Testing**](clean-code/09-testing.ts) | Viết test sạch | Given/When/Then naming, AAA pattern, mỗi test 1 behavior, test độc lập |
| 10 | [**Async & Performance**](clean-code/10-async-performance.ts) | Async/Await & Hiệu năng | Tránh callback hell, `Promise.all` cho parallel, `Promise.allSettled`, chunking tránh block event loop, retry pattern |

### TypeScript Nâng Cao (Rules 11–18)

| # | Quy tắc | Mô tả | Nguyên tắc chính |
|---|---------|--------|------------------|
| 11 | [**Immutability**](clean-code/11-immutability.ts) | Immutability & Pure Functions | Không mutate object gốc, `readonly`, `ReadonlyArray`, pure functions, deep immutability, `DeepReadonly<T>` |
| 12 | [**Encapsulation**](clean-code/12-encapsulation.ts) | Encapsulation & Information Hiding | Private fields (`#`), getter/setter có validation, defensive copy, expose API tối thiểu |
| 13 | [**Dependency Injection**](clean-code/13-dependency-injection.ts) | DI & Loose Coupling | Constructor injection, code to interfaces, dễ mock/test, composition root |
| 14 | [**Guard Clauses**](clean-code/14-guard-clauses.ts) | Guard Clauses & Early Return | Return sớm, fail fast, `continue` trong loop, assertion functions, lookup map thay if/else |
| 15 | [**Type Safety**](clean-code/15-type-safety.ts) | Type Safety & Type Guards | Tránh `any`, discriminated unions, exhaustive switch (`never`), branded types, template literal types |
| 16 | [**Collections**](clean-code/16-collections.ts) | Collections & Data Transformation | Higher-order functions, pipeline pattern, `Map`/`Set`, chunking, pagination, pipe utility |
| 17 | [**Defensive Programming**](clean-code/17-defensive-programming.ts) | Defensive Programming | Validate ở boundary, sanitize input, Null Object pattern, nullish coalescing (`??`), optional chaining (`?.`) |
| 18 | [**Code Smells**](clean-code/18-code-smells.ts) | Code Smells & Refactoring | Value Objects (Primitive Obsession), Extract Method, Tell Don't Ask, polymorphism thay conditional |

---

## 🎨 Design Patterns — 17 Patterns

### 🏗️ Creational Patterns — Tạo object

| Pattern | File | Ví dụ thực tế | Khi nào dùng? |
|---------|------|---------------|---------------|
| **Singleton** | [singleton.ts](design-patterns/creational/singleton.ts) | Database Connection | Chỉ cần 1 instance duy nhất |
| **Factory Method** | [factory-method.ts](design-patterns/creational/factory-method.ts) | Notification System (Email/SMS/Push) | Delegate việc tạo object cho subclass |
| **Abstract Factory** | [abstract-factory.ts](design-patterns/creational/abstract-factory.ts) | UI Theme (Light/Dark) | Tạo family of related objects |
| **Builder** | [builder.ts](design-patterns/creational/builder.ts) | HTTP Request Builder | Object phức tạp, cần xây step-by-step |
| **Prototype** | [prototype.ts](design-patterns/creational/prototype.ts) | Game Character Cloning | Clone object thay vì tạo mới |

### 🔧 Structural Patterns — Cấu trúc object

| Pattern | File | Ví dụ thực tế | Khi nào dùng? |
|---------|------|---------------|---------------|
| **Adapter** | [adapter.ts](design-patterns/structural/adapter.ts) | Payment Gateway (Stripe/PayPal) | Interface không tương thích |
| **Bridge** | [bridge.ts](design-patterns/structural/bridge.ts) | Notification × Sender | Tránh class explosion |
| **Composite** | [composite.ts](design-patterns/structural/composite.ts) | File System Tree | Cấu trúc cây, xử lý đồng nhất |
| **Decorator** | [decorator.ts](design-patterns/structural/decorator.ts) | DataSource (encrypt/compress/log) | Thêm behavior động |
| **Facade** | [facade.ts](design-patterns/structural/facade.ts) | Order Processing | Đơn giản hóa hệ thống phức tạp |
| **Proxy** | [proxy.ts](design-patterns/structural/proxy.ts) | API Service (cache/auth/rate-limit) | Kiểm soát truy cập |

### 🎭 Behavioral Patterns — Hành vi

| Pattern | File | Ví dụ thực tế | Khi nào dùng? |
|---------|------|---------------|---------------|
| **Observer** | [observer.ts](design-patterns/behavioral/observer.ts) | Stock Market (pub/sub) | Event notification system |
| **Strategy** | [strategy.ts](design-patterns/behavioral/strategy.ts) | Shopping Cart Pricing | Swap algorithm tại runtime |
| **Command** | [command.ts](design-patterns/behavioral/command.ts) | Text Editor Undo/Redo | Đóng gói request, undo/redo |
| **State** | [state.ts](design-patterns/behavioral/state.ts) | Order Lifecycle | State machine |
| **Template Method** | [template-method.ts](design-patterns/behavioral/template-method.ts) | Data Pipeline (CSV/API/Log) | Skeleton algorithm, subclass customize |
| **Chain of Responsibility** | [chain-of-responsibility.ts](design-patterns/behavioral/chain-of-responsibility.ts) | HTTP Middleware | Pipeline/Middleware |

---

## 🚀 Cách sử dụng

### Chạy thử

```bash
# Cài dependencies
npm install -g typescript ts-node

# Chạy bất kỳ file nào
ts-node coding-convention/clean-code/01-naming.ts
ts-node coding-convention/clean-code/09-testing.ts
ts-node coding-convention/design-patterns/creational/singleton.ts
```

### Gợi ý học tập

1. **Beginner** → Bắt đầu từ `01-naming` đến `08-magic-numbers`
2. **Intermediate** → `09-testing` đến `14-guard-clauses`
3. **Advanced** → `15-type-safety` đến `18-code-smells` + Design Patterns

### Format mỗi file

Mỗi file đều theo cấu trúc:

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
| **Tổng cộng** | **35 files** | — |

### Quy tắc vàng

- ✅ **Tên rõ ràng** — Code tự giải thích
- ✅ **Hàm < 30 dòng** — Mỗi hàm một việc
- ✅ **DRY** — Không lặp logic
- ✅ **SOLID** — Thiết kế linh hoạt
- ✅ **Immutable** — Không mutate object gốc
- ✅ **Type-safe** — Tận dụng TypeScript
- ✅ **Test sạch** — AAA pattern, given/when/then
- ✅ **Async đúng cách** — `Promise.all`, retry, chunking
- ✅ **Guard clauses** — Fail fast, early return
- ✅ **Encapsulation** — Ẩn implementation details

---

## 📚 Tham khảo

- [Clean Code — Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Design Patterns — Gang of Four](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Refactoring Guru — Design Patterns](https://refactoring.guru/design-patterns)

---

> 💡 **Tip**: Mở file bất kỳ, đọc phần comment header để hiểu nguyên tắc, sau đó so sánh ❌ BAD vs ✅ GOOD.
