/**
 * ============================================
 * CLEAN CODE RULE #10: ASYNC/AWAIT & PERFORMANCE
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng async/await thay vì callback hell
 * 2. Xử lý lỗi async đúng cách
 * 3. Chạy song song khi các task độc lập (Promise.all)
 * 4. Tránh block event loop
 * 5. Dùng Promise.allSettled khi cần tất cả kết quả
 */

// ═══════════════════════════════════════════
// Rule 10.1: Async/Await thay vì Callback Hell
// ═══════════════════════════════════════════

// ❌ BAD: Callback hell (pyramid of doom)
function processOrder_BAD(orderId: string) {
  getOrder(orderId).then((order) => {
    validateOrder(order).then((validated) => {
      calculateTotal(validated).then((total) => {
        processPayment(total).then((payment) => {
          sendConfirmation(payment).then((result) => {
            console.log('Done:', result);
          }).catch((err) => console.error(err));
        }).catch((err) => console.error(err));
      }).catch((err) => console.error(err));
    }).catch((err) => console.error(err));
  }).catch((err) => console.error(err));
}

// ✅ GOOD: Flat, readable async/await
async function processOrderClean(orderId: string): Promise<string> {
  const order = await getOrder(orderId);
  const validatedOrder = await validateOrder(order);
  const total = await calculateTotal(validatedOrder);
  const payment = await processPayment(total);
  const confirmation = await sendConfirmation(payment);
  return confirmation;
}

// ═══════════════════════════════════════════
// Rule 10.2: Chạy song song khi các task độc lập
// ═══════════════════════════════════════════

interface DashboardData {
  user: { name: string };
  orders: { id: string }[];
  notifications: { message: string }[];
  analytics: { views: number };
}

// ❌ BAD: Chạy tuần tự (sequential) → chậm
async function getDashboard_BAD(userId: string): Promise<DashboardData> {
  const user = await fetchUser(userId);             // 200ms
  const orders = await fetchOrders(userId);          // 300ms
  const notifications = await fetchNotifications(userId); // 150ms
  const analytics = await fetchAnalytics(userId);    // 250ms
  // Tổng: 200 + 300 + 150 + 250 = 900ms 😰

  return { user, orders, notifications, analytics };
}

// ✅ GOOD: Chạy song song (parallel) → nhanh
async function getDashboard(userId: string): Promise<DashboardData> {
  const [user, orders, notifications, analytics] = await Promise.all([
    fetchUser(userId),
    fetchOrders(userId),
    fetchNotifications(userId),
    fetchAnalytics(userId),
  ]);
  // Tổng: max(200, 300, 150, 250) = 300ms 🚀

  return { user, orders, notifications, analytics };
}

// ═══════════════════════════════════════════
// Rule 10.3: Promise.allSettled khi cần tất cả kết quả
// ═══════════════════════════════════════════

// ❌ BAD: Promise.all fail tất cả nếu 1 cái fail
async function notifyAllUsers_BAD(userIds: string[]) {
  try {
    // Nếu 1 user fail → tất cả bị cancel
    await Promise.all(userIds.map((id) => sendNotification(id)));
  } catch {
    console.error('Some notification failed, but which one?');
  }
}

// ✅ GOOD: allSettled → biết chính xác cái nào thành/bại
interface NotificationResult {
  userId: string;
  success: boolean;
  error?: string;
}

async function notifyAllUsers(userIds: string[]): Promise<NotificationResult[]> {
  const results = await Promise.allSettled(
    userIds.map((id) => sendNotification(id)),
  );

  return results.map((result, index) => ({
    userId: userIds[index],
    success: result.status === 'fulfilled',
    error: result.status === 'rejected' ? String(result.reason) : undefined,
  }));
}

// ═══════════════════════════════════════════
// Rule 10.4: Tránh block event loop
// ═══════════════════════════════════════════

// ❌ BAD: Xử lý CPU-intensive trên main thread
function processLargeDataset_BAD(data: number[]): number[] {
  // Block event loop nếu data > 1M items
  return data
    .filter((n) => n > 0)
    .map((n) => Math.sqrt(n))
    .sort((a, b) => a - b);
}

// ✅ GOOD: Chunk processing để không block event loop
async function processLargeDataset(data: number[]): Promise<number[]> {
  const CHUNK_SIZE = 10_000;
  const results: number[] = [];

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    const processed = chunk
      .filter((n) => n > 0)
      .map((n) => Math.sqrt(n));
    results.push(...processed);

    // Nhường lại event loop sau mỗi chunk
    if (i + CHUNK_SIZE < data.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results.sort((a, b) => a - b);
}

// ═══════════════════════════════════════════
// Rule 10.5: Retry Pattern cho network calls
// ═══════════════════════════════════════════

interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1_000,
  backoffMultiplier: 2,
};

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.delayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${options.maxAttempts} failed: ${lastError.message}`);

      if (attempt < options.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= options.backoffMultiplier;
      }
    }
  }

  throw new Error(`All ${options.maxAttempts} attempts failed. Last: ${lastError?.message}`);
}

// Sử dụng:
async function fetchDataWithRetry(): Promise<unknown> {
  return withRetry(
    () => fetch('https://api.example.com/data').then((r) => r.json()),
    { maxAttempts: 3, delayMs: 500, backoffMultiplier: 2 },
  );
}

// ═══════════════════════════════════════════
// Helper functions (giả lập)
// ═══════════════════════════════════════════

async function getOrder(id: string) { return { id, items: [] }; }
async function validateOrder(order: any) { return order; }
async function calculateTotal(order: any) { return 100; }
async function processPayment(total: number) { return { total, paid: true }; }
async function sendConfirmation(payment: any) { return 'confirmed'; }
async function fetchUser(id: string) { return { name: 'John' }; }
async function fetchOrders(userId: string) { return [{ id: '1' }]; }
async function fetchNotifications(userId: string) { return [{ message: 'Hi' }]; }
async function fetchAnalytics(userId: string) { return { views: 1000 }; }
async function sendNotification(userId: string) { return true; }

export {
  processOrderClean,
  getDashboard,
  notifyAllUsers,
  processLargeDataset,
  withRetry,
};
