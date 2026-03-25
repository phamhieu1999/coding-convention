/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    ADAPTER PATTERN                           ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Chuyển đổi interface KHÔNG TƯƠNG THÍCH thành interface  │
 * │ mà client mong đợi. "Cầu nối" giữa 2 interface.       │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Adapter sạc điện thoại: ổ cắm Mỹ (110V, 2 chân) vs ổ cắm VN (220V, 2 chân tròn).
 * Adapter chuyển đổi giữa 2 chuẩn mà không sửa ổ cắm hay thiết bị.
 *
 * 📐 FLOW:
 *  Client ──► [Target Interface] ──► Adapter ──► [Adaptee API]
 *  Code gọi    PaymentGateway       StripeAdapter    Stripe SDK
 *
 * ✅ KHI NÀO DÙNG:
 *   - Tích hợp third-party library có interface khác
 *   - Wrap legacy code để dùng với code mới
 *   - Chuẩn hóa nhiều APIs khác nhau về 1 interface
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Interface đã tương thích sẵn
 *   - Có thể sửa source code trực tiếp
 */

// ============================================================
// TARGET INTERFACE (cái client mong đợi)
// ============================================================

interface PaymentResult {
  readonly success: boolean;
  readonly transactionId: string;
  readonly amount: number;
  readonly currency: string;
  readonly provider: string;
  readonly rawResponse?: unknown;
}

interface PaymentGateway {
  charge(amount: number, currency: string, token: string): Promise<PaymentResult>;
  refund(transactionId: string, amount: number): Promise<PaymentResult>;
  getTransaction(transactionId: string): Promise<PaymentResult | null>;
}

// ============================================================
// ADAPTEE 1: Stripe (amount tính bằng cents, API khác hoàn toàn)
// ============================================================

interface StripeCharge {
  id: string;
  amount: number;          // ⚠️ Cents, không phải dollars
  currency: string;
  status: "succeeded" | "failed" | "pending";
  payment_method: string;
}

class StripeSDK {
  createCharge(params: { amount: number; currency: string; source: string }): StripeCharge {
    console.log(`  [Stripe] Creating charge: ${params.amount} ${params.currency} cents`);
    return {
      id: `ch_${Date.now()}`,
      amount: params.amount,
      currency: params.currency,
      status: "succeeded",
      payment_method: params.source,
    };
  }

  createRefund(params: { charge: string; amount: number }): { id: string; status: string } {
    console.log(`  [Stripe] Refunding charge ${params.charge}: ${params.amount} cents`);
    return { id: `re_${Date.now()}`, status: "succeeded" };
  }

  retrieveCharge(chargeId: string): StripeCharge | null {
    console.log(`  [Stripe] Retrieving charge ${chargeId}`);
    return { id: chargeId, amount: 9999, currency: "usd", status: "succeeded", payment_method: "card" };
  }
}

// ============================================================
// ADAPTEE 2: PayPal (API structure hoàn toàn khác)
// ============================================================

interface PayPalPayment {
  paymentId: string;
  state: "approved" | "failed" | "created";
  transactions: Array<{ amount: { total: string; currency: string } }>;
}

class PayPalSDK {
  createPayment(body: { total: string; currency: string }): PayPalPayment {
    console.log(`  [PayPal] Creating payment: $${body.total} ${body.currency}`);
    return {
      paymentId: `PAY-${Date.now()}`,
      state: "approved",
      transactions: [{ amount: { total: body.total, currency: body.currency } }],
    };
  }

  refundSale(saleId: string, body: { total: string }): { refund_id: string; state: string } {
    console.log(`  [PayPal] Refunding sale ${saleId}: $${body.total}`);
    return { refund_id: `REF-${Date.now()}`, state: "completed" };
  }

  getPayment(paymentId: string): PayPalPayment | null {
    console.log(`  [PayPal] Getting payment ${paymentId}`);
    return { paymentId, state: "approved", transactions: [{ amount: { total: "99.99", currency: "USD" } }] };
  }
}

// ============================================================
// ADAPTERS
// ============================================================

/** Adapter: chuyển Stripe API → PaymentGateway interface */
class StripeAdapter implements PaymentGateway {
  constructor(private readonly stripe: StripeSDK) {}

  async charge(amount: number, currency: string, token: string): Promise<PaymentResult> {
    // ⚠️ Chuyển dollars → cents (Stripe yêu cầu cents)
    const charge = this.stripe.createCharge({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      source: token,
    });
    return this.mapChargeToResult(charge);
  }

  async refund(transactionId: string, amount: number): Promise<PaymentResult> {
    const result = this.stripe.createRefund({
      charge: transactionId,
      amount: Math.round(amount * 100),
    });
    return {
      success: result.status === "succeeded",
      transactionId: result.id,
      amount,
      currency: "usd",
      provider: "stripe",
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult | null> {
    const charge = this.stripe.retrieveCharge(transactionId);
    return charge ? this.mapChargeToResult(charge) : null;
  }

  private mapChargeToResult(charge: StripeCharge): PaymentResult {
    return {
      success: charge.status === "succeeded",
      transactionId: charge.id,
      amount: charge.amount / 100,  // ⚠️ Cents → dollars
      currency: charge.currency,
      provider: "stripe",
      rawResponse: charge,
    };
  }
}

/** Adapter: chuyển PayPal API → PaymentGateway interface */
class PayPalAdapter implements PaymentGateway {
  constructor(private readonly paypal: PayPalSDK) {}

  async charge(amount: number, currency: string, _token: string): Promise<PaymentResult> {
    const payment = this.paypal.createPayment({
      total: amount.toFixed(2),
      currency: currency.toUpperCase(),
    });
    return this.mapPaymentToResult(payment, amount, currency);
  }

  async refund(transactionId: string, amount: number): Promise<PaymentResult> {
    const result = this.paypal.refundSale(transactionId, { total: amount.toFixed(2) });
    return {
      success: result.state === "completed",
      transactionId: result.refund_id,
      amount,
      currency: "USD",
      provider: "paypal",
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult | null> {
    const payment = this.paypal.getPayment(transactionId);
    if (!payment) return null;
    const amount = parseFloat(payment.transactions[0]?.amount.total ?? "0");
    const currency = payment.transactions[0]?.amount.currency ?? "USD";
    return this.mapPaymentToResult(payment, amount, currency);
  }

  private mapPaymentToResult(payment: PayPalPayment, amount: number, currency: string): PaymentResult {
    return {
      success: payment.state === "approved",
      transactionId: payment.paymentId,
      amount,
      currency,
      provider: "paypal",
      rawResponse: payment,
    };
  }
}

// ============================================================
// CLIENT CODE → chỉ dùng PaymentGateway, không biết Stripe/PayPal
// ============================================================

async function processPayment(gateway: PaymentGateway, amount: number) {
  console.log(`\n💳 Processing $${amount}...`);

  const result = await gateway.charge(amount, "USD", "tok_visa_test");
  console.log(`  Result: ${result.success ? "✅" : "❌"} | ID: ${result.transactionId} | Provider: ${result.provider}`);

  if (result.success) {
    const refundResult = await gateway.refund(result.transactionId, amount / 2);
    console.log(`  Partial refund: ${refundResult.success ? "✅" : "❌"} $${amount / 2}`);
  }
}

async function demo() {
  // Đổi payment provider = đổi adapter, business logic KHÔNG đổi
  console.log("=== Stripe ===");
  await processPayment(new StripeAdapter(new StripeSDK()), 99.99);

  console.log("\n=== PayPal ===");
  await processPayment(new PayPalAdapter(new PayPalSDK()), 149.99);
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Adapter = wrapper chuyển đổi interface, KHÔNG thêm logic mới
 * 2. Client (processPayment) chỉ biết PaymentGateway interface
 * 3. Mỗi adapter xử lý đặc thù riêng (cents vs dollars, field names)
 * 4. Thêm provider mới (MoMo, VNPay) = thêm adapter, KHÔNG sửa client
 * 5. NestJS: Adapter pattern phổ biến trong:
 *    - Platform adapters (Express vs Fastify)
 *    - @nestjs/microservices transport adapters
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ PAYMENT GATEWAY INTEGRATION (ví dụ trên)
 *    Bài toán: Stripe dùng cents, field "source"; PayPal dùng dollars, field "total".
 *    MoMo dùng VND, response XML. VNPay dùng query string + checksum.
 *    Giải pháp: Mỗi adapter wrap SDK riêng → chuẩn hóa thành PaymentGateway interface.
 *    Kết quả: Controller gọi gateway.charge(100, "USD") — không biết Stripe hay PayPal.
 *
 * 2️⃣ LEGACY SYSTEM INTEGRATION
 *    Bài toán: Hệ thống ERP cũ (SOAP/XML) cần kết nối với microservices mới (REST/JSON).
 *    Không thể sửa ERP (20 năm, vendor lock-in). Microservices chỉ hiểu JSON.
 *    Giải pháp: ERPAdapter nhận JSON request → convert sang SOAP XML → gửi ERP
 *    → nhận SOAP response → convert ngược lại JSON → trả microservice.
 *    Thực tế: Rất phổ biến khi migrate hệ thống ngân hàng, bảo hiểm, chính phủ.
 *
 * 3️⃣ THIRD-PARTY API NORMALIZATION
 *    Bài toán: App dùng OpenWeatherMap API (field: "temp", "humidity") 
 *    nhưng cần đổi sang AccuWeather (field: "Temperature.Value", "RelativeHumidity").
 *    Giải pháp: WeatherAdapter chuẩn hóa response → { temperature, humidity, wind }.
 *    Đổi provider = đổi adapter, KHÔNG sửa business logic hiển thị weather.
 *
 * 4️⃣ DATA FORMAT CONVERTER
 *    Bài toán: Import data từ nhiều nguồn (CSV, Excel, XML, JSON lines).
 *    Mỗi format parse khác nhau nhưng business logic cần cùng 1 interface.
 *    Giải pháp: CSVAdapter, ExcelAdapter, XMLAdapter → đều trả Record<string, any>[].
 *    Code: const adapter = DataAdapterFactory.create(file.extension);
 *          const rows = adapter.parse(file.buffer); // Cùng kiểu output
 *
 * 5️⃣ NESTJS PLATFORM ADAPTER (thực tế framework)
 *    Bài toán: NestJS chạy trên Express (default) hoặc Fastify (performance).
 *    Request/Response API của 2 framework khác nhau hoàn toàn.
 *    Giải pháp: NestJS dùng Adapter pattern internally:
 *    - ExpressAdapter wraps express → NestJS HTTP interface
 *    - FastifyAdapter wraps fastify → cùng NestJS HTTP interface
 *    Code: const app = await NestFactory.create(AppModule, new FastifyAdapter());
 *    → Business code KHÔNG thay đổi khi đổi từ Express sang Fastify.
 *
 * 📌 ADAPTER vs FACADE vs DECORATOR:
 *    Adapter: chuyển đổi INTERFACE (incompatible → compatible)
 *    Facade: đơn giản hóa subsystem (complex → simple)
 *    Decorator: thêm BEHAVIOR (same interface + extra features)
 */

export { PaymentGateway, StripeAdapter, PayPalAdapter };
