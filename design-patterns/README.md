# 🎨 Design Patterns in TypeScript

Bộ sưu tập đầy đủ các Design Pattern phổ biến, implement bằng TypeScript với ví dụ thực tế.

## 📂 Cấu trúc

```
design-patterns/
├── creational/          # Patterns tạo object
│   ├── singleton.ts         # Database Connection (1 instance duy nhất)
│   ├── factory-method.ts    # Notification System (Email/SMS/Push/Slack)
│   ├── abstract-factory.ts  # UI Theme (Light/Dark components)
│   ├── builder.ts           # HTTP Request Builder (method chaining)
│   └── prototype.ts         # Game Character Cloning
│
├── structural/          # Patterns cấu trúc object
│   ├── adapter.ts           # Payment Gateway (Stripe/PayPal adapter)
│   ├── bridge.ts            # Notification × Sender (tránh class explosion)
│   ├── composite.ts         # File System Tree (recursive structure)
│   ├── decorator.ts         # DataSource (encrypt/compress/log stacking)
│   ├── facade.ts            # Order Processing (đơn giản hóa 5 subsystems)
│   └── proxy.ts             # API Service (cache/auth/rate-limit proxy)
│
├── behavioral/          # Patterns hành vi giữa objects
│   ├── observer.ts              # Stock Market (pub/sub events)
│   ├── strategy.ts              # Shopping Cart Pricing (swap algorithms)
│   ├── command.ts               # Text Editor Undo/Redo
│   ├── state.ts                 # Order Lifecycle (state machine)
│   ├── template-method.ts       # Data Pipeline (CSV/API/Log)
│   └── chain-of-responsibility.ts # HTTP Middleware (auth/rate-limit chain)
│
└── README.md
```

## 🏗️ Creational Patterns (Tạo object)

| Pattern | Mục đích | Ví dụ |
|---------|----------|-------|
| **Singleton** | Đảm bảo chỉ 1 instance | Database Connection |
| **Factory Method** | Delegate việc tạo object cho subclass | Notification System |
| **Abstract Factory** | Tạo family of related objects | UI Theme (Light/Dark) |
| **Builder** | Xây dựng object phức tạp step-by-step | HTTP Request Builder |
| **Prototype** | Clone object thay vì tạo mới | Game Character |

## 🔧 Structural Patterns (Cấu trúc)

| Pattern | Mục đích | Ví dụ |
|---------|----------|-------|
| **Adapter** | Chuyển đổi interface không tương thích | Payment Gateway |
| **Bridge** | Tách abstraction khỏi implementation | Notification × Sender |
| **Composite** | Cấu trúc cây, xử lý đồng nhất | File System |
| **Decorator** | Thêm behavior động bằng wrapping | Encrypt/Compress/Log |
| **Facade** | Interface đơn giản cho hệ thống phức tạp | Order Processing |
| **Proxy** | Kiểm soát truy cập đến object | Cache/Auth/Rate-Limit |

## 🎭 Behavioral Patterns (Hành vi)

| Pattern | Mục đích | Ví dụ |
|---------|----------|-------|
| **Observer** | One-to-many event notification | Stock Market |
| **Strategy** | Hoán đổi algorithm tại runtime | Pricing Strategy |
| **Command** | Đóng gói request, hỗ trợ undo/redo | Text Editor |
| **State** | Thay đổi behavior theo state | Order Lifecycle |
| **Template Method** | Skeleton algorithm, subclass customize | Data Pipeline |
| **Chain of Responsibility** | Truyền request qua chuỗi handlers | HTTP Middleware |

## 🚀 Chạy thử

```bash
# Cài TypeScript (nếu chưa có)
npm install -g typescript ts-node

# Chạy bất kỳ pattern nào
ts-node design-patterns/creational/singleton.ts
ts-node design-patterns/behavioral/observer.ts
ts-node design-patterns/structural/proxy.ts
```

## 💡 Khi nào dùng pattern nào?

- **Chỉ có 1 instance?** → Singleton
- **Tạo object linh hoạt?** → Factory / Abstract Factory
- **Object phức tạp nhiều steps?** → Builder
- **Clone object?** → Prototype
- **Tích hợp API khác nhau?** → Adapter
- **Tránh class explosion?** → Bridge
- **Cấu trúc cây?** → Composite
- **Thêm feature không sửa class?** → Decorator
- **API đơn giản cho hệ thống phức tạp?** → Facade
- **Kiểm soát truy cập?** → Proxy
- **Event system?** → Observer
- **Swap algorithm?** → Strategy
- **Undo/Redo?** → Command
- **State machine?** → State
- **Algorithm template?** → Template Method
- **Pipeline/Middleware?** → Chain of Responsibility
