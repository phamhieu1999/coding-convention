/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                     FACADE PATTERN                           ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Cung cấp interface đơn giản cho hệ thống phức tạp.
 *
 * 🏠 ANALOGY: Gọi 115 cấp cứu → bạn chỉ nói "cần xe cứu thương",
 * không cần biết: tìm BV, gọi tài xế, check xe → 115 làm hết.
 *
 * FLOW: Client → DeployFacade.deploy() → Build + Test + Docker + K8s + Slack
 */

// ============================================================
// SUBSYSTEMS
// ============================================================

class BuildSystem {
  install(): void { console.log("  📦 [Build] Installing dependencies..."); }
  lint(): boolean { console.log("  📦 [Build] Linting... ✅"); return true; }
  compile(): boolean { console.log("  📦 [Build] Compiling... ✅"); return true; }
  bundle(): string { console.log("  📦 [Build] Bundling..."); return "dist/app.js"; }
}

class TestSystem {
  runUnit(): { passed: number; failed: number } {
    console.log("  🧪 [Test] Unit tests..."); return { passed: 142, failed: 0 };
  }
  runIntegration(): { passed: number; failed: number } {
    console.log("  🧪 [Test] Integration tests..."); return { passed: 38, failed: 0 };
  }
  checkCoverage(): number { const c = 87.5; console.log(`  🧪 [Test] Coverage: ${c}%`); return c; }
}

class DockerSystem {
  buildImage(tag: string): string { console.log(`  🐳 [Docker] Building: ${tag}`); return `registry.io/app:${tag}`; }
  pushImage(image: string): void { console.log(`  🐳 [Docker] Pushing ${image}`); }
  scan(image: string): { critical: number } { console.log(`  🐳 [Docker] Scanning ${image}`); return { critical: 0 }; }
}

class KubernetesSystem {
  setContext(cluster: string): void { console.log(`  ☸️  [K8s] Context: ${cluster}`); }
  deploy(image: string, replicas: number): void { console.log(`  ☸️  [K8s] Deploying ${image} x${replicas}`); }
  rollback(): void { console.log("  ☸️  [K8s] Rolling back..."); }
  healthCheck(): boolean { console.log("  ☸️  [K8s] Health check ✅"); return true; }
}

class SlackNotifier {
  send(channel: string, msg: string): void { console.log(`  💬 [Slack] #${channel}: ${msg}`); }
}

// ============================================================
// FACADE
// ============================================================

interface DeployConfig {
  readonly cluster: "staging" | "production";
  readonly replicas: number;
  readonly minCoverage: number;
}

interface DeployResult {
  success: boolean;
  image?: string;
  error?: string;
}

class DeployFacade {
  private readonly build = new BuildSystem();
  private readonly test = new TestSystem();
  private readonly docker = new DockerSystem();
  private readonly k8s = new KubernetesSystem();
  private readonly slack = new SlackNotifier();

  /** Client chỉ cần gọi 1 method → orchestrate 5 subsystems */
  async deploy(config: DeployConfig): Promise<DeployResult> {
    const tag = `${config.cluster}-${Date.now()}`;
    console.log(`\n${"═".repeat(50)}`);
    console.log(`🚀 DEPLOYING TO ${config.cluster.toUpperCase()}`);
    console.log(`${"═".repeat(50)}`);

    try {
      // Build
      this.build.install();
      if (!this.build.lint() || !this.build.compile()) throw new Error("Build failed");
      this.build.bundle();

      // Test
      const unit = this.test.runUnit();
      if (unit.failed > 0) throw new Error("Unit tests failed");
      const coverage = this.test.checkCoverage();
      if (coverage < config.minCoverage) throw new Error(`Coverage ${coverage}% < ${config.minCoverage}%`);

      // Docker
      const image = this.docker.buildImage(tag);
      if (this.docker.scan(image).critical > 0) throw new Error("Critical vulnerabilities");
      this.docker.pushImage(image);

      // Deploy
      this.k8s.setContext(config.cluster);
      this.k8s.deploy(image, config.replicas);
      if (!this.k8s.healthCheck()) throw new Error("Health check failed");

      this.slack.send("deploys", `✅ Deployed ${image} to ${config.cluster}`);
      return { success: true, image };
    } catch (error: any) {
      this.slack.send("deploys", `❌ Deploy FAILED: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  rollback(cluster: string): void {
    this.k8s.setContext(cluster);
    this.k8s.rollback();
    this.k8s.healthCheck();
    this.slack.send("deploys", `🔄 Rolled back ${cluster}`);
  }
}

// ============================================================
// USAGE
// ============================================================

async function demo() {
  const deployer = new DeployFacade();
  await deployer.deploy({ cluster: "staging", replicas: 2, minCoverage: 80 });
  await deployer.deploy({ cluster: "production", replicas: 3, minCoverage: 90 });
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Facade CHỈ orchestrate, KHÔNG thêm logic mới
 * 2. Client: 1 method call → 5 subsystems phối hợp
 * 3. Subsystems vẫn accessible trực tiếp nếu cần fine control
 * 4. NestJS: Service layer = Facade cho Repos + External APIs
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ CI/CD DEPLOYMENT PIPELINE (ví dụ trên)
 *    Bài toán: Deploy production cần 5 bước: build → test → docker → k8s → notify.
 *    Nếu DevOps phải chạy thủ công 5 commands → dễ sai thứ tự, bỏ sót bước.
 *    Giải pháp: DeployFacade.deploy({ cluster: "production" }) → 1 lệnh = làm hết.
 *    Subsystem vẫn dùng riêng được: dockerSystem.buildImage("manual-tag").
 *
 * 2️⃣ E-COMMERCE CHECKOUT
 *    Bài toán: Checkout cần 7 bước: validate cart → check inventory → calculate tax
 *    → apply coupon → charge payment → create order → send email.
 *    Giải pháp: CheckoutFacade.processOrder(cart, user) orchestrate tất cả.
 *    Code: class CheckoutFacade {
 *            async processOrder(cart, user) {
 *              this.cartService.validate(cart);
 *              this.inventoryService.reserve(cart.items);
 *              const tax = this.taxService.calculate(cart, user.address);
 *              const total = this.couponService.applyDiscount(cart.total, user.couponCode);
 *              await this.paymentService.charge(user, total + tax);
 *              const order = await this.orderService.create(cart, user);
 *              await this.emailService.sendConfirmation(user, order);
 *              return order;
 *            }
 *          }
 *
 * 3️⃣ USER ONBOARDING
 *    Bài toán: Tạo user mới cần: create account → setup profile → assign default role
 *    → create workspace → send welcome email → track analytics event.
 *    Giải pháp: OnboardingFacade.register(userData) → 1 API call = full setup.
 *    Nếu 1 bước fail → facade xử lý rollback (delete account đã tạo).
 *
 * 4️⃣ REPORT GENERATION
 *    Bài toán: Generate monthly report cần: query DB → aggregate data → generate chart
 *    → render PDF → upload S3 → email to stakeholders.
 *    Giải pháp: ReportFacade.generateMonthlyReport(month)
 *    Client (cron job) chỉ cần gọi 1 method, không biết chi tiết subsystems.
 *
 * 5️⃣ NESTJS SERVICE LAYER (thực tế hàng ngày)
 *    Bài toán: Controller nhận request → cần gọi repo, external API, cache,
 *    event emitter, logger — quá nhiều dependencies trong 1 controller.
 *    Giải pháp: Service = Facade wrap nhiều repos + services.
 *    Controller chỉ inject 1 service → gọi 1 method.
 *    Code: @Controller('orders')
 *          class OrderController {
 *            constructor(private readonly orderService: OrderService) {} // ← Facade
 *            @Post() create(@Body() dto) { return this.orderService.createOrder(dto); }
 *          }
 *
 * 📌 FACADE vs ADAPTER vs MEDIATOR:
 *    Facade: GIẢN LƯỢC interface (complex system → simple API cho client)
 *    Adapter: CHUYỂN ĐỔI interface (incompatible → compatible)
 *    Mediator: ĐIỀU PHỐI communication giữa nhiều objects (objects không gọi trực tiếp nhau)
 */

export { DeployFacade };
