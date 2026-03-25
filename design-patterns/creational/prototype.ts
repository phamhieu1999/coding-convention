/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    PROTOTYPE PATTERN                         ║
 * ║                   (Creational Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Tạo object mới bằng cách CLONE từ object hiện có,      │
 * │ tránh tạo lại từ đầu (tốn kém).                        │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Photocopy tài liệu: thay vì viết lại từ đầu, bạn copy bản gốc
 * rồi chỉ sửa vài chỗ cần thiết. Nhanh hơn rất nhiều.
 *
 * ✅ KHI NÀO DÙNG:
 *   - Tạo object tốn kém (complex init, API call, DB query)
 *   - Cần nhiều biến thể nhỏ từ cùng 1 base
 *   - Config templates, document templates
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Object đơn giản, tạo nhanh
 *   - Object có circular references (clone phức tạp)
 *
 * 📐 CLASS DIAGRAM:
 *
 *  ┌─────────────────────────┐
 *  │    «interface»          │
 *  │    Prototype<T>         │
 *  ├─────────────────────────┤
 *  │ + clone(): T            │
 *  │ + deepClone(): T        │
 *  └───────────┬─────────────┘
 *              │ implements
 *  ┌───────────▼─────────────┐     ┌──────────────────┐
 *  │   ServerConfig          │     │ ConfigRegistry   │
 *  ├─────────────────────────┤     ├──────────────────┤
 *  │ - name: string          │     │ - templates: Map │
 *  │ - env: Environment      │◄────│ + register()     │
 *  │ - resources: Resources  │     │ + create()       │
 *  │ - features: string[]    │     │ + list()         │
 *  └─────────────────────────┘     └──────────────────┘
 */

// ============================================================
// PROTOTYPE INTERFACE
// ============================================================

interface Prototype<T> {
  /** Shallow clone (nested objects vẫn shared reference!) */
  clone(): T;
  /** Deep clone (nested objects cũng được copy hoàn toàn) */
  deepClone(): T;
}

// ============================================================
// TYPES
// ============================================================

interface Resources {
  cpu: number;      // cores
  memory: number;   // MB
  disk: number;     // GB
  replicas: number;
}

interface NetworkConfig {
  port: number;
  ssl: boolean;
  cors: string[];
  rateLimit: number; // req/s
}

type Environment = "development" | "staging" | "production";

// ============================================================
// CONCRETE PROTOTYPE
// ============================================================

class ServerConfig implements Prototype<ServerConfig> {
  constructor(
    public name: string,
    public env: Environment,
    public resources: Resources,
    public network: NetworkConfig,
    public features: string[],
    public envVars: Record<string, string>
  ) {}

  clone(): ServerConfig {
    // ⚠️ Shallow clone: resources, network, features vẫn là CÙNG reference
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  deepClone(): ServerConfig {
    // ✅ Deep clone: tất cả nested objects đều được copy
    return new ServerConfig(
      this.name,
      this.env,
      { ...this.resources },
      { ...this.network, cors: [...this.network.cors] },
      [...this.features],
      { ...this.envVars }
    );
  }

  toString(): string {
    return [
      `┌── ${this.name} (${this.env}) ──`,
      `│ CPU: ${this.resources.cpu} cores | RAM: ${this.resources.memory}MB | Disk: ${this.resources.disk}GB`,
      `│ Replicas: ${this.resources.replicas}`,
      `│ Port: ${this.network.port} | SSL: ${this.network.ssl} | Rate: ${this.network.rateLimit} req/s`,
      `│ CORS: [${this.network.cors.join(", ")}]`,
      `│ Features: [${this.features.join(", ")}]`,
      `│ Env Vars: ${JSON.stringify(this.envVars)}`,
      `└${"─".repeat(40)}`,
    ].join("\n");
  }
}

// ============================================================
// PROTOTYPE REGISTRY
// ============================================================

class ConfigRegistry {
  private readonly templates = new Map<string, ServerConfig>();

  register(key: string, config: ServerConfig): void {
    this.templates.set(key, config);
  }

  /**
   * Tạo config mới từ template (deep clone)
   * @param key - tên template
   * @param overrides - ghi đè một số thuộc tính
   */
  create(key: string, overrides?: Partial<Pick<ServerConfig, "name" | "env">>): ServerConfig {
    const template = this.templates.get(key);
    if (!template) {
      throw new Error(`Template "${key}" not found! Available: ${this.list().join(", ")}`);
    }

    const clone = template.deepClone();
    if (overrides?.name) clone.name = overrides.name;
    if (overrides?.env) clone.env = overrides.env;
    return clone;
  }

  list(): string[] {
    return Array.from(this.templates.keys());
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  // Setup registry với các templates
  const registry = new ConfigRegistry();

  // Template: Microservice nhỏ
  registry.register("microservice", new ServerConfig(
    "microservice-template",
    "development",
    { cpu: 1, memory: 512, disk: 10, replicas: 1 },
    { port: 3000, ssl: false, cors: ["http://localhost:3000"], rateLimit: 100 },
    ["health-check", "metrics"],
    { NODE_ENV: "development", LOG_LEVEL: "debug" }
  ));

  // Template: API Gateway
  registry.register("gateway", new ServerConfig(
    "gateway-template",
    "production",
    { cpu: 4, memory: 4096, disk: 50, replicas: 3 },
    { port: 443, ssl: true, cors: ["https://app.example.com"], rateLimit: 10000 },
    ["health-check", "metrics", "rate-limiting", "auth", "logging"],
    { NODE_ENV: "production", LOG_LEVEL: "warn", JWT_SECRET: "xxx" }
  ));

  console.log("=== Available Templates ===");
  console.log(registry.list().join(", "));

  // Clone và customize
  console.log("\n=== Clone: User Service (from microservice) ===");
  const userService = registry.create("microservice", { name: "user-service" });
  userService.resources.memory = 1024;  // Tăng RAM
  userService.features.push("caching");
  userService.envVars.DB_URL = "postgres://localhost/users";
  console.log(userService.toString());

  console.log("\n=== Clone: Order Service (from microservice) ===");
  const orderService = registry.create("microservice", { name: "order-service" });
  orderService.resources.cpu = 2;
  orderService.features.push("event-sourcing");
  orderService.envVars.KAFKA_URL = "kafka://localhost:9092";
  console.log(orderService.toString());

  console.log("\n=== Clone: Staging Gateway (from gateway) ===");
  const stagingGW = registry.create("gateway", { name: "staging-gateway", env: "staging" });
  stagingGW.resources.replicas = 1;
  stagingGW.network.rateLimit = 1000;
  console.log(stagingGW.toString());

  // ✅ Verify: template gốc KHÔNG bị thay đổi
  console.log("\n=== Original Template (unchanged) ===");
  const original = registry.create("microservice");
  console.log("Memory still 512?", original.resources.memory === 512);   // true
  console.log("No caching feature?", !original.features.includes("caching")); // true
  console.log("No DB_URL?", !original.envVars.DB_URL);                   // true

  // ⚠️ Demo shallow vs deep clone
  console.log("\n=== Shallow vs Deep Clone ===");
  const base = registry.create("microservice", { name: "base" });
  const shallow = base.clone();
  const deep = base.deepClone();

  shallow.features.push("SHALLOW-ADDED");
  console.log("Base features after shallow clone modified:", base.features);
  // ⚠️ base.features bị ảnh hưởng vì shallow clone share reference!

  deep.features.push("DEEP-ADDED");
  console.log("Base features after deep clone modified:", base.features);
  // ✅ base.features KHÔNG bị ảnh hưởng vì deep clone copy hoàn toàn
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Deep clone vs Shallow clone: luôn dùng deep clone với nested objects
 * 2. Registry pattern: quản lý templates tập trung
 * 3. Clone + customize > new từ đầu khi object phức tạp
 * 4. Object.freeze() cho immutable parts nếu cần
 * 5. structuredClone() (Node 17+) là alternative built-in cho deep clone
 *    const clone = structuredClone(original);
 * 6. NestJS: ConfigService có thể dùng pattern này cho multi-environment
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ SERVER/INFRASTRUCTURE CONFIG TEMPLATES (ví dụ trên)
 *    Bài toán: Tạo config cho 50 microservices. Mỗi service khác nhau chút
 *    (tên, port, CPU) nhưng 80% config giống nhau (logging, healthcheck, network).
 *    Giải pháp: Clone từ template "microservice" → chỉ sửa vài fields.
 *    Thực tế: Kubernetes Helm charts, Terraform modules, Docker Compose profiles.
 *    → Tạo 50 configs trong 5 phút thay vì viết tay từ đầu.
 *
 * 2️⃣ EMAIL TEMPLATE ENGINE
 *    Bài toán: 20 loại email (welcome, reset-password, order-confirm...) có
 *    chung header, footer, branding. Chỉ khác title, body, CTA button.
 *    Giải pháp: Clone baseEmailTemplate → customize subject, body, variables.
 *    Code: const email = templateRegistry.create("order-confirm");
 *          email.subject = `Order #${orderId} confirmed`;
 *          email.body = renderTemplate(email.body, { orderId, items });
 *
 * 3️⃣ GAME CHARACTER / NPC SPAWNING
 *    Bài toán: Game cần spawn 1000 enemies mỗi level. Tạo new Enemy() mỗi lần
 *    rất tốn (load textures, calculate stats, init AI). 
 *    Giải pháp: Clone từ prototype enemy → chỉ thay đổi position, health.
 *    Thực tế: Unity/Unreal prefab system chính là Prototype pattern.
 *    → 1 prototype "Goblin" clone ra 100 goblins, mỗi con khác position.
 *
 * 4️⃣ TEST DATA FACTORY (Database Seeding)
 *    Bài toán: Integration test cần 100 users với data hợp lệ. Tạo bằng tay
 *    từng user tốn thời gian, dễ thiếu required fields.
 *    Giải pháp: Clone baseUser template → randomize name, email.
 *    Thực tế: factory-girl, fishery, faker.js kết hợp Prototype.
 *    Code: const user = userFactory.create({ role: "admin" });
 *          // Clone base user, override role = admin
 *
 * 5️⃣ A/B TEST VARIANTS
 *    Bài toán: Tạo A/B test cho landing page. Variant A = base, Variant B
 *    chỉ khác button color và headline. Variant C khác layout.
 *    Giải pháp: Clone basePage → modify vài fields cho mỗi variant.
 *    → Tránh duplicate toàn bộ page config (DRY principle).
 *
 * 📌 KHI NÀO PROTOTYPE vs NEW:
 *    ✅ Prototype: object phức tạp (10+ fields), tạo tốn kém, nhiều biến thể nhỏ
 *    ❌ New: object đơn giản, mỗi instance khác nhau hoàn toàn
 *    ⚠️ LUÔN dùng deepClone() nếu có nested objects → tránh shared reference bug
 */

export { Prototype, ServerConfig, ConfigRegistry };
