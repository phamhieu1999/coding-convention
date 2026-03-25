/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                  FACTORY METHOD PATTERN                      ║
 * ║                   (Creational Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Định nghĩa interface để tạo object, nhưng để SUBCLASS   │
 * │ quyết định CLASS NÀO sẽ được khởi tạo.                  │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Công ty logistics có nhiều phương tiện (xe tải, tàu, máy bay).
 * Bạn gọi "ship()" mà không cần biết dùng phương tiện nào.
 * Factory quyết định tạo loại phương tiện phù hợp.
 *
 * ✅ KHI NÀO DÙNG:
 *   - Chưa biết trước loại object cần tạo
 *   - Muốn mở rộng thêm loại mới mà không sửa code cũ (OCP)
 *   - Tách biệt logic tạo object khỏi business logic
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Chỉ có 1 loại object → tạo trực tiếp, không cần factory
 *   - Quá ít biến thể → over-engineering
 *
 * 📐 CLASS DIAGRAM:
 *
 *  ┌──────────────────┐         ┌──────────────────┐
 *  │  «interface»     │         │  «abstract»      │
 *  │  Logger          │◄────────│  LoggerFactory    │
 *  ├──────────────────┤         ├──────────────────┤
 *  │ + log()          │         │ + createLogger() │ ← factory method
 *  │ + setLevel()     │         │ + logMessage()   │ ← uses factory method
 *  └──────┬───────────┘         └──────┬───────────┘
 *         │ implements                  │ extends
 *   ┌─────┼──────┐              ┌──────┼──────┐
 *   ▼     ▼      ▼              ▼      ▼      ▼
 * Console File  Cloud      Console  File   Cloud
 * Logger Logger Logger     Factory Factory Factory
 */

// ============================================================
// PRODUCT INTERFACE
// ============================================================

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly context?: string;
}

/** Product: interface mà tất cả loggers phải implement */
interface Logger {
  log(entry: LogEntry): void;
  setLevel(level: LogLevel): void;
  flush(): Promise<void>;
}

// ============================================================
// CONCRETE PRODUCTS
// ============================================================

class ConsoleLogger implements Logger {
  private minLevel: LogLevel = "DEBUG";
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3,
  };
  private static readonly ICONS: Record<LogLevel, string> = {
    DEBUG: "🔍", INFO: "ℹ️ ", WARN: "⚠️ ", ERROR: "🔴",
  };

  log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;
    const icon = ConsoleLogger.ICONS[entry.level];
    const time = entry.timestamp.toISOString().slice(11, 23);
    const ctx = entry.context ? `[${entry.context}]` : "";
    console.log(`${icon} ${time} ${entry.level.padEnd(5)} ${ctx} ${entry.message}`);
  }

  setLevel(level: LogLevel): void { this.minLevel = level; }
  async flush(): Promise<void> { /* console tự flush */ }

  private shouldLog(level: LogLevel): boolean {
    return ConsoleLogger.LEVEL_PRIORITY[level] >= ConsoleLogger.LEVEL_PRIORITY[this.minLevel];
  }
}

class FileLogger implements Logger {
  private readonly buffer: string[] = [];
  private minLevel: LogLevel = "INFO";
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3,
  };

  constructor(private readonly filePath: string) {}

  log(entry: LogEntry): void {
    if (FileLogger.LEVEL_PRIORITY[entry.level] < FileLogger.LEVEL_PRIORITY[this.minLevel]) return;
    const line = `${entry.timestamp.toISOString()} [${entry.level}] ${entry.context ?? "-"}: ${entry.message}`;
    this.buffer.push(line);
    console.log(`  📁 [File → ${this.filePath}] ${line}`);
  }

  setLevel(level: LogLevel): void { this.minLevel = level; }

  async flush(): Promise<void> {
    console.log(`  📁 Flushing ${this.buffer.length} entries to ${this.filePath}`);
    this.buffer.length = 0;
  }
}

class CloudLogger implements Logger {
  private readonly queue: LogEntry[] = [];
  private minLevel: LogLevel = "WARN";
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3,
  };

  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  log(entry: LogEntry): void {
    if (CloudLogger.LEVEL_PRIORITY[entry.level] < CloudLogger.LEVEL_PRIORITY[this.minLevel]) return;
    this.queue.push(entry);
    console.log(`  ☁️  [Cloud → ${this.endpoint}] ${entry.level}: ${entry.message}`);
  }

  setLevel(level: LogLevel): void { this.minLevel = level; }

  async flush(): Promise<void> {
    console.log(`  ☁️  Sending ${this.queue.length} entries to ${this.endpoint}`);
    this.queue.length = 0;
  }
}

// ============================================================
// FACTORY (CREATOR)
// ============================================================

/** Abstract Creator: định nghĩa factory method */
abstract class LoggerFactory {
  // 🔑 FACTORY METHOD → subclass quyết định tạo logger nào
  protected abstract createLogger(): Logger;

  /** Template method: sử dụng factory method bên trong */
  logMessage(level: LogLevel, message: string, context?: string): void {
    const logger = this.createLogger();
    logger.log({
      level,
      message,
      timestamp: new Date(),
      context,
    });
  }
}

// ============================================================
// CONCRETE FACTORIES
// ============================================================

class ConsoleLoggerFactory extends LoggerFactory {
  private logger?: ConsoleLogger;

  protected createLogger(): Logger {
    // Cache logger instance (lazy init + reuse)
    if (!this.logger) {
      this.logger = new ConsoleLogger();
    }
    return this.logger;
  }
}

class FileLoggerFactory extends LoggerFactory {
  private logger?: FileLogger;

  constructor(private readonly filePath: string) {
    super();
  }

  protected createLogger(): Logger {
    if (!this.logger) {
      this.logger = new FileLogger(this.filePath);
    }
    return this.logger;
  }
}

class CloudLoggerFactory extends LoggerFactory {
  private logger?: CloudLogger;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string
  ) {
    super();
  }

  protected createLogger(): Logger {
    if (!this.logger) {
      this.logger = new CloudLogger(this.endpoint, this.apiKey);
    }
    return this.logger;
  }
}

// ============================================================
// SIMPLE FACTORY (bonus: config-based, không cần subclass)
// ============================================================

type LoggerType = "console" | "file" | "cloud";

class SimpleLoggerFactory {
  static create(type: LoggerType, options?: Record<string, string>): Logger {
    switch (type) {
      case "console":
        return new ConsoleLogger();
      case "file":
        return new FileLogger(options?.path ?? "app.log");
      case "cloud":
        return new CloudLogger(
          options?.endpoint ?? "https://logs.api.com",
          options?.apiKey ?? "default-key"
        );
      default:
        throw new Error(`Unknown logger type: ${type}`);
    }
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  console.log("=== Factory Method: Mỗi factory tạo đúng loại Logger ===\n");

  // Client KHÔNG cần biết concrete class
  const factories: LoggerFactory[] = [
    new ConsoleLoggerFactory(),
    new FileLoggerFactory("/var/log/app.log"),
    new CloudLoggerFactory("https://logs.datadog.com", "api-key-xyz"),
  ];

  factories.forEach((factory) => {
    factory.logMessage("ERROR", "Server crashed!", "AppModule");
  });

  console.log("\n=== Simple Factory: tạo bằng config string ===\n");

  const logger = SimpleLoggerFactory.create("console");
  logger.log({ level: "INFO", message: "App started", timestamp: new Date(), context: "Main" });
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Factory Method = abstract method trong Creator → subclass override
 * 2. Simple Factory = static method + switch → đơn giản hơn, ít flexible hơn
 * 3. Tuân thủ OCP: thêm loại logger mới = thêm class mới, KHÔNG sửa code cũ
 * 4. Client chỉ biết interface Logger, không biết ConsoleLogger/FileLogger
 * 5. NestJS equivalent: Custom Provider + useFactory
 *    { provide: 'LOGGER', useFactory: () => new ConsoleLogger() }
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ PAYMENT PROCESSOR FACTORY
 *    Bài toán: E-commerce hỗ trợ VNPay, MoMo, ZaloPay. Mỗi cổng có SDK
 *    riêng, API khác hoàn toàn. Controller KHÔNG nên biết chi tiết SDK.
 *    Giải pháp: PaymentFactory.create("vnpay") → trả về VNPayProcessor
 *    implements PaymentProcessor. Thêm MoMo = thêm class, không sửa controller.
 *    Code: const processor = PaymentFactory.create(order.paymentMethod);
 *          await processor.charge(order.total);
 *
 * 2️⃣ NOTIFICATION CHANNEL FACTORY
 *    Bài toán: Gửi thông báo qua Email/SMS/Push/Slack tùy user preference.
 *    Giải pháp: NotificationFactory.create(user.preferredChannel)
 *    → trả về EmailSender | SMSSender | PushSender
 *    Mỗi sender biết cách format message phù hợp kênh của mình.
 *
 * 3️⃣ AUTH STRATEGY FACTORY
 *    Bài toán: App hỗ trợ login bằng password, Google OAuth, SAML, API key.
 *    Mỗi loại cần validate token khác nhau.
 *    Giải pháp: AuthFactory.create(authType) → trả về AuthProvider
 *    Controller: const auth = AuthFactory.create(req.headers['x-auth-type']);
 *               const user = await auth.validate(token);
 *
 * 4️⃣ EXPORT FORMAT FACTORY
 *    Bài toán: User muốn export report sang PDF/Excel/CSV.
 *    Giải pháp: ExportFactory.create("pdf") → PDFExporter
 *    Mỗi exporter biết cách render header, table, chart cho format đó.
 *    Code: const exporter = ExportFactory.create(req.query.format);
 *          const file = exporter.generate(reportData);
 *
 * 5️⃣ STORAGE BACKEND FACTORY
 *    Bài toán: Upload file muốn lưu ở local disk (dev), S3 (staging),
 *    GCS (production). Đổi backend = đổi config, không sửa code.
 *    Giải pháp: StorageFactory.create(process.env.STORAGE_TYPE)
 *    → LocalStorage | S3Storage | GCSStorage
 *
 * 6️⃣ DATABASE DRIVER FACTORY (NestJS thực tế)
 *    Bài toán: App cần chạy trên PostgreSQL (prod) và SQLite (test).
 *    Giải pháp: TypeORM dùng Factory Method internally:
 *    TypeOrmModule.forRoot({ type: 'postgres' }) → tạo PgDriver
 *    TypeOrmModule.forRoot({ type: 'sqlite' })   → tạo SqliteDriver
 *    Business code KHÔNG thay đổi khi đổi database.
 *
 * 📌 QUY TẮC CHỌN: Simple Factory vs Factory Method
 *    - Simple Factory: khi logic tạo đơn giản, ít biến thể, team nhỏ
 *    - Factory Method: khi cần mở rộng, mỗi factory có logic phức tạp riêng
 *    - Abstract Factory: khi cần tạo FAMILY objects (xem abstract-factory.ts)
 */

export { Logger, LogEntry, LoggerFactory, ConsoleLoggerFactory, FileLoggerFactory, CloudLoggerFactory, SimpleLoggerFactory };
