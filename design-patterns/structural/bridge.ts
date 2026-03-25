/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                     BRIDGE PATTERN                           ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Tách ABSTRACTION (what) khỏi IMPLEMENTATION (how)       │
 * │ để cả hai có thể thay đổi ĐỘC LẬP.                    │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Remote TV (abstraction) và TV (implementation).
 * Remote có thể là remote thường hoặc remote cao cấp.
 * TV có thể là Sony, Samsung, LG.
 * Mỗi remote hoạt động với mỗi TV → không cần class cho từng combo.
 *
 * ⚠️ KHÔNG CÓ BRIDGE (class explosion):
 *   EmailAlert, SMSAlert, SlackAlert, TelegramAlert
 *   EmailPromo, SMSPromo, SlackPromo, TelegramPromo
 *   EmailReport, SMSReport, SlackReport, TelegramReport
 *   = 3 × 4 = 12 classes! Thêm 1 channel = +3 classes
 *
 * ✅ CÓ BRIDGE:
 *   3 abstractions + 4 implementations = 7 classes
 *   Thêm 1 channel = +1 class only!
 *
 * 📐 CLASS DIAGRAM:
 *
 *     ABSTRACTION (what)              IMPLEMENTATION (how)
 *  ┌─────────────────┐             ┌──────────────────────┐
 *  │ Notification     │ ──has──►   │ «interface»          │
 *  │ (abstract)       │             │ MessageTransport     │
 *  ├─────────────────┤             ├──────────────────────┤
 *  │ # transport      │             │ + send(to, subject,  │
 *  │ + send()         │             │         body): void  │
 *  └────────┬────────┘             └───────────┬──────────┘
 *           │ extends                          │ implements
 *     ┌─────┼─────┐               ┌───────┬───┴───┬───────┐
 *     ▼     ▼     ▼               ▼       ▼       ▼       ▼
 *   Alert Promo Report         Email    SMS    Slack   Telegram
 */

// ============================================================
// IMPLEMENTATION (how to send → "transport")
// ============================================================

interface MessagePayload {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly priority: "low" | "normal" | "high" | "urgent";
}

interface MessageTransport {
  readonly name: string;
  send(payload: MessagePayload): void;
  isAvailable(): boolean;
}

// --- Concrete Implementations ---

class EmailTransport implements MessageTransport {
  readonly name = "Email";

  send(payload: MessagePayload): void {
    const priorityFlag = payload.priority === "urgent" ? "🔴 " : "";
    console.log(`    📧 EMAIL to: ${payload.to}`);
    console.log(`       Subject: ${priorityFlag}${payload.subject}`);
    console.log(`       Body: ${payload.body.substring(0, 80)}...`);
  }

  isAvailable(): boolean { return true; }
}

class SMSTransport implements MessageTransport {
  readonly name = "SMS";
  private readonly maxLength = 160;

  send(payload: MessagePayload): void {
    const text = `${payload.subject}: ${payload.body}`;
    const truncated = text.length > this.maxLength
      ? text.substring(0, this.maxLength - 3) + "..."
      : text;
    console.log(`    📱 SMS to: ${payload.to} → "${truncated}"`);
  }

  isAvailable(): boolean { return true; }
}

class SlackTransport implements MessageTransport {
  readonly name = "Slack";

  constructor(private readonly webhookUrl: string = "https://hooks.slack.com/xxx") {}

  send(payload: MessagePayload): void {
    const emoji = payload.priority === "urgent" ? "🚨" : "📢";
    console.log(`    💬 SLACK → #${payload.to}`);
    console.log(`       ${emoji} *${payload.subject}*`);
    console.log(`       ${payload.body}`);
  }

  isAvailable(): boolean { return true; }
}

class TelegramTransport implements MessageTransport {
  readonly name = "Telegram";

  send(payload: MessagePayload): void {
    console.log(`    ✈️  TELEGRAM → @${payload.to}`);
    console.log(`       <b>${payload.subject}</b>`);
    console.log(`       ${payload.body}`);
  }

  isAvailable(): boolean { return true; }
}

// ============================================================
// ABSTRACTION (what to send → "notification type")
// ============================================================

abstract class Notification {
  constructor(protected readonly transport: MessageTransport) {}

  abstract send(recipient: string, message: string): void;

  /** Gửi qua nhiều transports (fallback) */
  protected sendWithFallback(payload: MessagePayload, fallbacks: MessageTransport[]): void {
    if (this.transport.isAvailable()) {
      this.transport.send(payload);
    } else {
      const fallback = fallbacks.find((t) => t.isAvailable());
      if (fallback) fallback.send(payload);
      else console.log("    ❌ All transports unavailable!");
    }
  }
}

// --- Refined Abstractions ---

class AlertNotification extends Notification {
  send(recipient: string, message: string): void {
    console.log(`  🚨 ALERT (via ${this.transport.name}):`);
    this.transport.send({
      to: recipient,
      subject: "🚨 CRITICAL ALERT",
      body: `IMMEDIATE ACTION REQUIRED: ${message}`,
      priority: "urgent",
    });
  }
}

class PromotionNotification extends Notification {
  constructor(
    transport: MessageTransport,
    private readonly promoCode: string,
    private readonly discount: number
  ) {
    super(transport);
  }

  send(recipient: string, message: string): void {
    console.log(`  🎉 PROMO (via ${this.transport.name}):`);
    this.transport.send({
      to: recipient,
      subject: `🎉 ${this.discount}% OFF - Limited Time!`,
      body: `${message}\n\n🎫 Use code: ${this.promoCode}`,
      priority: "normal",
    });
  }
}

class ReportNotification extends Notification {
  send(recipient: string, message: string): void {
    const date = new Date().toISOString().slice(0, 10);
    console.log(`  📊 REPORT (via ${this.transport.name}):`);
    this.transport.send({
      to: recipient,
      subject: `📊 Daily Report - ${date}`,
      body: message,
      priority: "low",
    });
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  // Transports (how)
  const email = new EmailTransport();
  const sms = new SMSTransport();
  const slack = new SlackTransport();
  const telegram = new TelegramTransport();

  console.log("═══ Cùng 1 loại notification, khác transport ═══");

  console.log("\n📍 Alert qua Email:");
  new AlertNotification(email).send("ops@company.com", "Database connection lost!");

  console.log("\n📍 Alert qua Slack:");
  new AlertNotification(slack).send("incidents", "Database connection lost!");

  console.log("\n📍 Alert qua SMS:");
  new AlertNotification(sms).send("+84901234567", "Database connection lost!");

  console.log("\n═══ Cùng 1 transport, khác loại notification ═══");

  console.log("\n📍 Alert qua Telegram:");
  new AlertNotification(telegram).send("admin_group", "CPU > 95%");

  console.log("\n📍 Promo qua Telegram:");
  new PromotionNotification(telegram, "SUMMER2024", 30).send("channel_deals", "Summer collection is here!");

  console.log("\n📍 Report qua Telegram:");
  new ReportNotification(telegram).send("reports_channel", "Revenue: $15,230 | Orders: 342 | Users: +58");
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Bridge = Composition over Inheritance
 *    Notification HAS-A Transport (thay vì EmailAlert extends Alert)
 * 2. Tách "what" (Alert/Promo/Report) khỏi "how" (Email/SMS/Slack)
 * 3. Thêm transport mới: +1 class. Thêm notification type: +1 class
 * 4. Không có Bridge: M types × N transports = M×N classes!
 * 5. NestJS: Logger + Transport pattern (Winston, Pino) chính là Bridge
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ NOTIFICATION SYSTEM (ví dụ trên)
 *    Bài toán: E-commerce cần gửi Alert, Promo, Report qua Email, SMS, Slack, Push.
 *    Không có Bridge: AlertEmail, AlertSMS, AlertSlack, AlertPush,
 *                     PromoEmail, PromoSMS, PromoSlack, PromoPush... = 12 classes!
 *    Có Bridge: 3 notification types + 4 transports = 7 classes.
 *    Thêm Telegram: chỉ +1 class TelegramTransport, tất cả notifications tự hỗ trợ.
 *
 * 2️⃣ RENDERING ENGINE (Graphics)
 *    Bài toán: App vẽ Circle, Square, Triangle bằng OpenGL hoặc DirectX hoặc Vulkan.
 *    Không Bridge: OpenGLCircle, DirectXCircle, VulkanCircle × 3 shapes = 9 classes.
 *    Có Bridge: Shape HAS-A Renderer → Circle(opengl) hoặc Circle(vulkan).
 *    Thực tế: Game engines (Unity, Unreal) tách Shape abstraction khỏi GPU API.
 *
 * 3️⃣ DATA PERSISTENCE LAYER
 *    Bài toán: App lưu User, Product, Order vào MySQL hoặc MongoDB hoặc DynamoDB.
 *    Không Bridge: MySQLUserRepo, MongoUserRepo, DynamoUserRepo × 3 entities = 9 classes.
 *    Có Bridge: Repository<T> HAS-A DatabaseDriver → UserRepo(mysqlDriver).
 *    Thực tế: TypeORM tách Entity (what) khỏi Driver (how to persist).
 *
 * 4️⃣ LOGGING SYSTEM (Winston / Pino)
 *    Bài toán: Log levels (Debug, Info, Error) gửi tới Console, File, CloudWatch, Sentry.
 *    Giải pháp: Logger HAS-A Transport[] → logger.addTransport(new SentryTransport()).
 *    Thực tế: Winston nội bộ dùng Bridge pattern:
 *    - Abstraction: Logger (format, level)
 *    - Implementation: Transport (Console, File, HTTP, Stream)
 *    Code: winston.createLogger({ transports: [new Console(), new File({ filename: 'app.log' })] })
 *
 * 5️⃣ REPORT GENERATOR
 *    Bài toán: Tạo SalesReport, InventoryReport, FinancialReport xuất ra PDF, Excel, HTML.
 *    Không Bridge: SalesReportPDF, SalesReportExcel, SalesReportHTML × 3 = 9 classes.
 *    Có Bridge: Report HAS-A Formatter → SalesReport(new PDFFormatter()).generate()
 *
 * 📌 BRIDGE vs STRATEGY:
 *    Bridge: tách 2 dimensions KHÁC NHAU (what + how), cả 2 cùng thay đổi
 *    Strategy: swap 1 algorithm tại runtime (context cố định, algorithm thay đổi)
 *    → Bridge khi BẢN THÂN abstraction cũng có variants (Alert vs Promo vs Report)
 *    → Strategy khi chỉ algorithm thay đổi (sort: bubble vs quick vs merge)
 */

export { MessageTransport, Notification, AlertNotification, PromotionNotification, ReportNotification };
