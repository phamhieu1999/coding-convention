/**
 * ============================================
 * PERFORMANCE #4: MEMORY MANAGEMENT
 * ============================================
 *
 * Nguyên tắc:
 * 1. Tránh memory leak — unsubscribe, clear timers, close connections
 * 2. Stream processing cho large data — không load hết vào memory
 * 3. WeakRef / WeakMap cho cache tự cleanup
 * 4. Limit buffer sizes — tránh unbounded growth
 * 5. Monitor memory usage — garbage collection awareness
 * 6. Avoid closure leaks — đừng giữ reference không cần thiết
 */

declare function setImmediate(callback: (...args: unknown[]) => void): unknown;
declare const process: { memoryUsage(): { heapUsed: number; heapTotal: number; rss: number; external: number } };

// ═══════════════════════════════════════════
// Rule 4.1: Stream Processing for Large Data
// ═══════════════════════════════════════════

// ❌ BAD: Load toàn bộ data vào memory → OOM khi data lớn
/*
async exportAllUsers(): Promise<Buffer> {
  // 1 million users × 1KB = 1GB in memory!
  const users = await this.userRepo.find();
  const csv = users.map(u => `${u.id},${u.name},${u.email}`).join('\n');
  return Buffer.from(csv);
}
*/

// ✅ GOOD: Stream processing — process từng chunk
/*
async exportAllUsers(response: Response): Promise<void> {
  response.setHeader('Content-Type', 'text/csv');
  response.setHeader('Content-Disposition', 'attachment; filename=users.csv');

  // Write header
  response.write('id,name,email\n');

  // Stream từ DB — process từng batch
  const queryRunner = this.dataSource.createQueryRunner();
  const stream = await queryRunner.stream('SELECT id, name, email FROM users');

  stream.on('data', (row: any) => {
    response.write(`${row.id},${row.name},${row.email}\n`);
  });

  stream.on('end', () => {
    queryRunner.release();
    response.end();
  });

  stream.on('error', (err: Error) => {
    queryRunner.release();
    response.status(500).end();
  });
}
*/

// ═══════════════════════════════════════════
// Rule 4.2: Batch Processing with Back-Pressure
// ═══════════════════════════════════════════

// ❌ BAD: Process tất cả cùng lúc → memory spike
/*
async sendBulkEmails(userIds: string[]): Promise<void> {
  const users = await this.userRepo.findByIds(userIds); // Load all
  const promises = users.map(u => this.emailService.send(u.email)); // All at once
  await Promise.all(promises); // 10,000 concurrent email calls!
}
*/

// ✅ GOOD: Process in batches với controlled concurrency

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchOptions = {},
): Promise<BatchResult<R>> {
  const { batchSize = 100, concurrency = 5, onProgress } = options;
  const results: R[] = [];
  const errors: BatchError[] = [];
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch với limited concurrency
    const batchResults = await processWithConcurrency(
      batch,
      processor,
      concurrency,
    );

    for (const result of batchResults) {
      if (result.success) {
        results.push(result.value!);
      } else {
        errors.push({ index: i + result.index, error: result.error! });
      }
    }

    processed += batch.length;
    onProgress?.(processed, items.length);

    // Allow GC between batches
    await new Promise(resolve => setImmediate(resolve));
  }

  return { results, errors, totalProcessed: processed };
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<ConcurrencyResult<R>[]> {
  const results: ConcurrencyResult<R>[] = [];
  let currentIndex = 0;

  const worker = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        const value = await processor(items[index]);
        results.push({ index, success: true, value });
      } catch (error) {
        results.push({ index, success: false, error: error as Error });
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
}

interface BatchResult<R> {
  results: R[];
  errors: BatchError[];
  totalProcessed: number;
}

interface BatchError {
  index: number;
  error: Error;
}

interface ConcurrencyResult<R> {
  index: number;
  success: boolean;
  value?: R;
  error?: Error;
}

// ═══════════════════════════════════════════
// Rule 4.3: WeakRef Cache — Auto GC
// ═══════════════════════════════════════════

// ❌ BAD: Map giữ strong reference → không bao giờ GC
/*
class UserCache {
  private cache = new Map<string, User>();
  // Cache grows forever → memory leak!
  set(id: string, user: User) { this.cache.set(id, user); }
}
*/

// ✅ GOOD: WeakRef cho optional cache — GC tự cleanup

class WeakCache<T extends object> {
  private cache = new Map<string, WeakRef<T>>();
  private registry: FinalizationRegistry<string>;

  constructor() {
    // Auto-cleanup khi object bị GC
    this.registry = new FinalizationRegistry((key: string) => {
      this.cache.delete(key);
    });
  }

  set(key: string, value: T): void {
    const existing = this.cache.get(key)?.deref();
    if (existing) return; // Already cached & alive

    const ref = new WeakRef(value);
    this.cache.set(key, ref);
    this.registry.register(value, key);
  }

  get(key: string): T | undefined {
    const ref = this.cache.get(key);
    if (!ref) return undefined;

    const value = ref.deref();
    if (!value) {
      this.cache.delete(key); // Cleanup dead ref
      return undefined;
    }

    return value;
  }

  get size(): number {
    return this.cache.size;
  }
}

// ═══════════════════════════════════════════
// Rule 4.4: Bounded Collections
// ═══════════════════════════════════════════

// ❌ BAD: Unbounded array → grows forever
/*
class EventLogger {
  private events: Event[] = [];
  log(event: Event) { this.events.push(event); } // Never cleaned!
}
*/

// ✅ GOOD: LRU Cache with max size

class BoundedMap<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  set(key: K, value: V): void {
    // Delete first to refresh insertion order
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    // Evict oldest if full
    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }

    this.map.set(key, value);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;

    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ═══════════════════════════════════════════
// Rule 4.5: Memory Leak Detection
// ═══════════════════════════════════════════

// ✅ GOOD: Monitor memory usage

class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private readonly maxSnapshots = 60;

  takeSnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.checkForLeak(snapshot);
    return snapshot;
  }

  private checkForLeak(current: MemorySnapshot): void {
    if (this.snapshots.length < 10) return;

    const recent = this.snapshots.slice(-10);
    const firstHeap = recent[0].heapUsedMB;
    const lastHeap = recent[recent.length - 1].heapUsedMB;

    // Heap tăng liên tục > 50% → potential leak
    if (lastHeap > firstHeap * 1.5) {
      console.warn(
        `[Memory] Potential leak detected: heap grew from ${firstHeap}MB to ${lastHeap}MB`,
      );
    }
  }

  getReport(): MemoryReport {
    const current = this.snapshots[this.snapshots.length - 1];
    const trend = this.calculateTrend();

    return {
      current,
      trend,
      snapshotCount: this.snapshots.length,
    };
  }

  private calculateTrend(): 'stable' | 'growing' | 'shrinking' {
    if (this.snapshots.length < 5) return 'stable';

    const recent = this.snapshots.slice(-5);
    const diffs = recent.slice(1).map((s, i) => s.heapUsedMB - recent[i].heapUsedMB);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

    if (avgDiff > 5) return 'growing';
    if (avgDiff < -5) return 'shrinking';
    return 'stable';
  }
}

interface MemorySnapshot {
  timestamp: Date;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
}

interface MemoryReport {
  current: MemorySnapshot;
  trend: 'stable' | 'growing' | 'shrinking';
  snapshotCount: number;
}

// ═══════════════════════════════════════════
// Rule 4.6: Cleanup on Module Destroy
// ═══════════════════════════════════════════

// ❌ BAD: Không cleanup resources khi shutdown
/*
@Injectable()
export class NotificationService {
  private interval: NodeJS.Timer;
  private connections: WebSocket[] = [];

  onModuleInit() {
    this.interval = setInterval(() => this.checkPending(), 5000);
    // interval + connections never cleaned up on shutdown!
  }
}
*/

// ✅ GOOD: Implement OnModuleDestroy
/*
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timer | null = null;
  private readonly connections = new Set<WebSocket>();

  onModuleInit(): void {
    this.interval = setInterval(() => this.checkPending(), 5000);
  }

  onModuleDestroy(): void {
    // Clear timers
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Close all connections
    for (const ws of this.connections) {
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();

    console.log('[NotificationService] Cleaned up resources');
  }
}
*/

export {
  processBatch,
  processWithConcurrency,
  WeakCache,
  BoundedMap,
  MemoryMonitor,
  type BatchOptions,
  type BatchResult,
  type MemorySnapshot,
  type MemoryReport,
};
