/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    OBSERVER PATTERN                          ║
 * ║                   (Behavioral Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Khi một object thay đổi state, tất cả dependents
 * (observers/subscribers) tự động được thông báo.
 *
 * 🏠 ANALOGY: Đăng ký YouTube channel. Khi có video mới,
 * TẤT CẢ subscribers nhận notification. Ai unsub thì thôi.
 *
 * 📐 FLOW:
 *  Subject ──notify()──► Observer1.update()
 *           ──notify()──► Observer2.update()
 *           ──notify()──► Observer3.update()
 */

// ============================================================
// TYPE-SAFE EVENT EMITTER (Generic)
// ============================================================

type EventMap = Record<string, unknown>;
type EventHandler<T> = (data: T) => void;

class TypedEventEmitter<Events extends EventMap> {
  private listeners = new Map<keyof Events, Set<EventHandler<any>>>();

  on<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Emit once to specific handler (fire and forget) */
  once<E extends keyof Events>(event: E, handler: EventHandler<Events[E]>): () => void {
    const wrapper: EventHandler<Events[E]> = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  protected emit<E extends keyof Events>(event: E, data: Events[E]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try { handler(data); } catch (e) { console.error(`Observer error on ${String(event)}:`, e); }
    });
  }

  listenerCount<E extends keyof Events>(event: E): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ============================================================
// CONCRETE SUBJECT: Order System
// ============================================================

type OrderEvents = {
  "order:created": { orderId: string; userId: string; total: number };
  "order:paid": { orderId: string; transactionId: string; amount: number };
  "order:shipped": { orderId: string; trackingNumber: string };
  "order:cancelled": { orderId: string; reason: string };
};

class OrderSystem extends TypedEventEmitter<OrderEvents> {
  createOrder(userId: string, total: number): string {
    const orderId = `ORD-${Date.now()}`;
    console.log(`📦 Order ${orderId} created: $${total}`);
    this.emit("order:created", { orderId, userId, total });
    return orderId;
  }

  payOrder(orderId: string, amount: number): void {
    const txId = `TXN-${Date.now()}`;
    console.log(`💰 Order ${orderId} paid: $${amount}`);
    this.emit("order:paid", { orderId, transactionId: txId, amount });
  }

  shipOrder(orderId: string): void {
    const tracking = `TRACK-${Date.now()}`;
    console.log(`🚚 Order ${orderId} shipped: ${tracking}`);
    this.emit("order:shipped", { orderId, trackingNumber: tracking });
  }

  cancelOrder(orderId: string, reason: string): void {
    console.log(`❌ Order ${orderId} cancelled: ${reason}`);
    this.emit("order:cancelled", { orderId, reason });
  }
}

// ============================================================
// OBSERVERS
// ============================================================

class EmailService {
  onOrderCreated(data: OrderEvents["order:created"]): void {
    console.log(`  📧 Email → User ${data.userId}: Your order ${data.orderId} is confirmed!`);
  }
  onOrderShipped(data: OrderEvents["order:shipped"]): void {
    console.log(`  📧 Email: Your order is shipped! Track: ${data.trackingNumber}`);
  }
}

class InventoryService {
  onOrderPaid(data: OrderEvents["order:paid"]): void {
    console.log(`  📦 Inventory: Reserving items for order ${data.orderId}`);
  }
  onOrderCancelled(data: OrderEvents["order:cancelled"]): void {
    console.log(`  📦 Inventory: Released items for ${data.orderId}`);
  }
}

class AnalyticsService {
  onOrderCreated(data: OrderEvents["order:created"]): void {
    console.log(`  📊 Analytics: New order $${data.total} tracked`);
  }
  onOrderPaid(data: OrderEvents["order:paid"]): void {
    console.log(`  📊 Analytics: Revenue +$${data.amount}`);
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  const orderSystem = new OrderSystem();
  const emailService = new EmailService();
  const inventory = new InventoryService();
  const analytics = new AnalyticsService();

  // Subscribe (bind handlers to events)
  orderSystem.on("order:created", (d) => emailService.onOrderCreated(d));
  orderSystem.on("order:created", (d) => analytics.onOrderCreated(d));
  orderSystem.on("order:paid", (d) => inventory.onOrderPaid(d));
  orderSystem.on("order:paid", (d) => analytics.onOrderPaid(d));
  orderSystem.on("order:shipped", (d) => emailService.onOrderShipped(d));

  // Unsubscribe function
  const unsubCancel = orderSystem.on("order:cancelled", (d) => inventory.onOrderCancelled(d));

  console.log("\n=== Create Order ===");
  const orderId = orderSystem.createOrder("user-123", 299.99);

  console.log("\n=== Pay Order ===");
  orderSystem.payOrder(orderId, 299.99);

  console.log("\n=== Ship Order ===");
  orderSystem.shipOrder(orderId);

  // Unsubscribe
  console.log("\n=== Cancel (after unsub inventory) ===");
  unsubCancel(); // Inventory sẽ KHÔNG nhận event cancel
  orderSystem.cancelOrder("ORD-other", "Customer request");

  console.log("\n=== Listener counts ===");
  console.log(`order:created listeners: ${orderSystem.listenerCount("order:created")}`);
  console.log(`order:cancelled listeners: ${orderSystem.listenerCount("order:cancelled")}`);
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Type-safe events: TypedEventEmitter<Events> → TypeScript auto-complete
 * 2. on() returns unsubscribe function → tránh memory leak
 * 3. Observers KHÔNG biết nhau → loose coupling
 * 4. Error isolation: 1 observer lỗi không ảnh hưởng observers khác
 * 5. NestJS: @EventEmitter2 package, CQRS event bus
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ EVENT-DRIVEN MICROSERVICES (ví dụ trên)
 *    Bài toán: Order được tạo → cần thông báo 5 services: Inventory, Payment,
 *    Email, Analytics, Shipping. Nếu OrderService gọi trực tiếp 5 services
 *    → tight coupling, thêm service = sửa OrderService.
 *    Giải pháp: OrderService emit "order:created" → 5 observers tự lắng nghe.
 *    Thêm LoyaltyService → chỉ thêm observer, KHÔNG sửa OrderService.
 *    Thực tế: NestJS EventEmitter2, RabbitMQ, Kafka, AWS SNS/SQS.
 *
 * 2️⃣ REAL-TIME NOTIFICATION (WebSocket)
 *    Bài toán: Chat app — khi user A gửi message trong group, tất cả
 *    members online cần nhận message real-time.
 *    Giải pháp: ChatRoom = Subject, mỗi connected user = Observer.
 *    User join = subscribe. User leave = unsubscribe. Message = notify all.
 *    Thực tế: Socket.IO rooms, WebSocket pub/sub, Firebase Realtime DB.
 *
 * 3️⃣ DOM EVENT HANDLING (Frontend)
 *    Bài toán: Button click cần: submit form + show loading + disable button
 *    + track analytics + validate inputs.
 *    Giải pháp: button.addEventListener("click", handler) = Observer pattern.
 *    Multiple handlers subscribe cùng 1 event. Browser = Subject.
 *    Thực tế: DOM Events, RxJS Observables, Vue reactive system, React state.
 *
 * 4️⃣ STOCK PRICE MONITORING
 *    Bài toán: 1000 users theo dõi giá BTC. Khi giá thay đổi, chỉ notify
 *    users đã đặt alert (giá > X hoặc giá < Y).
 *    Giải pháp: PriceTracker = Subject. Mỗi user alert = Observer.
 *    Khi price update → notify tất cả observers → mỗi observer tự filter.
 *    Thực tế: Trading platforms, crypto alerts, price comparison apps.
 *
 * 5️⃣ CACHE INVALIDATION
 *    Bài toán: User update profile → cache cũ cần xóa ở: Redis, CDN,
 *    browser cache, search index (Elasticsearch).
 *    Giải pháp: UserService emit "user:updated" → 4 observers tự invalidate cache.
 *    Code: userService.on("user:updated", (user) => redisCache.del(`user:${user.id}`));
 *          userService.on("user:updated", (user) => elasticsearch.update("users", user));
 *    Thực tế: Cache invalidation strategies, CDN purge, search reindex.
 *
 * 📌 OBSERVER vs EVENT BUS vs PUB/SUB:
 *    Observer: in-process, Subject biết Observers (direct reference)
 *    Event Bus: in-process, decoupled qua bus (EventEmitter2)
 *    Pub/Sub: cross-process, qua message broker (Kafka, RabbitMQ, Redis)
 *    → Tất cả đều dùng cùng PATTERN, khác scope (process vs distributed)
 */

export { TypedEventEmitter, OrderSystem };
