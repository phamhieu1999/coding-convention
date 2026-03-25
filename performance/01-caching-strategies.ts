/**
 * ============================================
 * PERFORMANCE #1: CACHING STRATEGIES
 * ============================================
 *
 * Nguyên tắc:
 * 1. Cache-aside (Lazy Loading) — read-heavy workloads
 * 2. Write-through — data consistency quan trọng
 * 3. TTL phù hợp — tránh stale data
 * 4. Cache invalidation — update/delete phải xóa cache
 * 5. Cache stampede prevention — locking / stale-while-revalidate
 * 6. Multi-layer cache — in-memory + Redis
 */

// ═══════════════════════════════════════════
// Rule 1.1: Cache-Aside Pattern
// ═══════════════════════════════════════════

// ❌ BAD: Query DB mỗi request, không cache
/*
@Injectable()
export class ProductService {
  async findById(id: string): Promise<Product> {
    // 50ms/query × 10,000 req/s = DB quá tải!
    return this.productRepository.findOne({ where: { id } });
  }
}
*/

// ✅ GOOD: Cache-aside — check cache → miss → query DB → set cache
/*
@Injectable()
export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cacheManager: Cache,
  ) {}

  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;

    // 1. Check cache first
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) return cached;

    // 2. Cache miss → query DB
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    // 3. Set cache with TTL
    await this.cacheManager.set(cacheKey, product, 300_000); // 5 minutes
    return product;
  }
}
*/

// ═══════════════════════════════════════════
// Rule 1.2: Cache Invalidation
// ═══════════════════════════════════════════

// ❌ BAD: Update DB nhưng quên xóa cache → stale data
/*
async update(id: string, dto: UpdateProductDto): Promise<Product> {
  await this.productRepository.update(id, dto);
  return this.productRepository.findOne({ where: { id } });
  // Cache vẫn trả data cũ trong 5 phút!
}
*/

// ✅ GOOD: Update DB + invalidate cache
/*
async update(id: string, dto: UpdateProductDto): Promise<Product> {
  const product = await this.productRepo.findOne({ where: { id } });
  if (!product) throw new NotFoundException();

  Object.assign(product, dto);
  const saved = await this.productRepo.save(product);

  // Xóa cache ngay sau khi update
  await this.cacheManager.del(`product:${id}`);
  // Xóa cả list cache nếu có
  await this.invalidateListCache('products');

  return saved;
}

private async invalidateListCache(prefix: string): Promise<void> {
  const keys = await this.redis.keys(`${prefix}:list:*`);
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}
*/

// ═══════════════════════════════════════════
// Rule 1.3: Cache Stampede Prevention
// ═══════════════════════════════════════════

// ❌ BAD: Cache expire → 1000 requests đồng thời query DB
/*
async getPopularProducts(): Promise<Product[]> {
  const cached = await this.cache.get('popular_products');
  if (cached) return cached;
  // 1000 concurrent requests all hit DB simultaneously!
  const products = await this.repo.findPopular();
  await this.cache.set('popular_products', products, 60_000);
  return products;
}
*/

// ✅ GOOD: Distributed lock + stale-while-revalidate

class CacheWithStampedePrevention {
  constructor(
    private readonly redis: any,
    private readonly lockTtlMs: number = 5_000,
  ) {}

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    // 1. Check cache
    const cached = await this.getCacheWithMeta<T>(key);

    if (cached && !cached.isStale) {
      return cached.data;
    }

    // 2. Return stale data while revalidating
    if (cached?.isStale) {
      this.revalidateInBackground(key, fetchFn, ttlMs);
      return cached.data;
    }

    // 3. Cache miss → acquire lock
    return this.fetchWithLock(key, fetchFn, ttlMs);
  }

  private async fetchWithLock<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    const acquired = await this.redis.set(
      lockKey, '1', 'PX', this.lockTtlMs, 'NX',
    );

    if (!acquired) {
      // Wait and retry — someone else is fetching
      await this.sleep(100);
      return this.getOrSet(key, fetchFn, ttlMs);
    }

    try {
      const data = await fetchFn();
      await this.setCacheWithMeta(key, data, ttlMs);
      return data;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async revalidateInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number,
  ): Promise<void> {
    // Fire and forget — don't block response
    this.fetchWithLock(key, fetchFn, ttlMs).catch(() => {});
  }

  private async getCacheWithMeta<T>(key: string): Promise<CacheMeta<T> | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const isStale = Date.now() > parsed.softExpiry;
    return { data: parsed.data, isStale };
  }

  private async setCacheWithMeta<T>(
    key: string,
    data: T,
    ttlMs: number,
  ): Promise<void> {
    const payload = {
      data,
      softExpiry: Date.now() + ttlMs,       // Soft TTL → marks as stale
    };
    const hardTtl = ttlMs * 2;               // Hard TTL → actual expiry
    await this.redis.set(key, JSON.stringify(payload), 'PX', hardTtl);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface CacheMeta<T> {
  data: T;
  isStale: boolean;
}

// ═══════════════════════════════════════════
// Rule 1.4: Multi-Layer Caching
// ═══════════════════════════════════════════

// ✅ GOOD: In-memory (L1) + Redis (L2)
/*
@Injectable()
export class MultiLayerCacheService {
  private readonly l1Cache = new Map<string, { data: unknown; expiry: number }>();
  private readonly l1MaxSize = 1000;

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    // L1 — in-memory (< 1ms)
    const l1 = this.getFromL1<T>(key);
    if (l1 !== null) return l1;

    // L2 — Redis (1-3ms)
    const l2 = await this.redis.get(key);
    if (l2) {
      const parsed = JSON.parse(l2) as T;
      this.setL1(key, parsed, 30_000);  // Cache locally 30s
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    this.setL1(key, data, Math.min(ttlMs, 30_000));
    await this.redis.set(key, JSON.stringify(data), 'PX', ttlMs);
  }

  private getFromL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.l1Cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setL1(key: string, data: unknown, ttlMs: number): void {
    if (this.l1Cache.size >= this.l1MaxSize) {
      const firstKey = this.l1Cache.keys().next().value;
      if (firstKey) this.l1Cache.delete(firstKey);
    }
    this.l1Cache.set(key, { data, expiry: Date.now() + ttlMs });
  }
}
*/

// ═══════════════════════════════════════════
// Rule 1.5: Cache Key Strategy
// ═══════════════════════════════════════════

// ❌ BAD: Magic string, không có prefix
/*
await cache.set('user_1', userData);          // Collision risk!
await cache.set('products', productList);     // No version, no context
*/

// ✅ GOOD: Structured cache key
const CACHE_KEY = {
  product: {
    detail: (id: string) => `product:detail:${id}`,
    list: (page: number, limit: number) => `product:list:p${page}:l${limit}`,
    popular: () => `product:popular:v1`,
    byCategory: (catId: string, page: number) =>
      `product:cat:${catId}:p${page}`,
  },
  user: {
    profile: (id: string) => `user:profile:${id}`,
    permissions: (id: string) => `user:perms:${id}`,
    session: (sessionId: string) => `session:${sessionId}`,
  },
} as const;

const CACHE_TTL = {
  SHORT: 30_000,       // 30 seconds — frequently changing
  MEDIUM: 300_000,     // 5 minutes — normal data
  LONG: 3_600_000,     // 1 hour — rarely changing
  DAY: 86_400_000,     // 24 hours — static data
} as const;

export {
  CacheWithStampedePrevention,
  CACHE_KEY,
  CACHE_TTL,
  type CacheMeta,
};
