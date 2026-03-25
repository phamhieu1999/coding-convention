/**
 * ============================================
 * PERFORMANCE #3: DATABASE POOLING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Connection pool — tái sử dụng connections, tránh overhead tạo mới
 * 2. Pool size phù hợp với workload — không quá lớn, không quá nhỏ
 * 3. Health check — detect và loại bỏ dead connections
 * 4. Connection timeout — tránh request chờ vô hạn
 * 5. Read replica — tách read/write workload
 * 6. Monitor pool metrics — phát hiện bottleneck sớm
 */

// ═══════════════════════════════════════════
// Rule 3.1: Connection Pool Configuration
// ═══════════════════════════════════════════

// ❌ BAD: Default config, không tune pool
/*
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  database: 'myapp',
  // Default pool = 10 connections → bottleneck khi traffic cao!
});
*/

// ✅ GOOD: Tuned pool config
/*
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  extra: {
    // Pool size = (CPU cores × 2) + effective_spindle_count
    // For 4-core server: (4 × 2) + 1 = ~10 per instance
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '5'),

    // Connection timeouts
    connectionTimeoutMillis: 5_000,      // Max wait for available connection
    idleTimeoutMillis: 30_000,           // Close idle connections after 30s
    allowExitOnIdle: true,               // Allow process exit when pool idle

    // Statement timeout — prevent long-running queries
    statement_timeout: 30_000,           // Kill queries > 30s
  },

  // TypeORM settings
  logging: process.env.NODE_ENV !== 'production',
  maxQueryExecutionTime: 5_000,  // Log slow queries > 5s
});
*/

// ═══════════════════════════════════════════
// Rule 3.2: Pool Size Formula
// ═══════════════════════════════════════════

// Formula: pool_size = (CPU cores × 2) + effective_spindle_count
// Lý do: Mỗi core handle 2 threads (context switch), +1 cho disk I/O

const calculateOptimalPoolSize = (
  cpuCores: number,
  instanceCount: number,
  maxDbConnections: number = 100,
): PoolSizeConfig => {
  const perInstanceMax = Math.floor(maxDbConnections / instanceCount);
  const optimal = (cpuCores * 2) + 1;

  return {
    max: Math.min(optimal, perInstanceMax),
    min: Math.max(2, Math.floor(optimal / 4)),
    recommended: optimal,
    maxDbConnections,
    instanceCount,
    warning: optimal > perInstanceMax
      ? `Pool size capped at ${perInstanceMax} (max_connections=${maxDbConnections} / ${instanceCount} instances)`
      : undefined,
  };
};

interface PoolSizeConfig {
  max: number;
  min: number;
  recommended: number;
  maxDbConnections: number;
  instanceCount: number;
  warning?: string;
}

// ═══════════════════════════════════════════
// Rule 3.3: Health Check & Connection Validation
// ═══════════════════════════════════════════

// ❌ BAD: Không validate connections → dùng dead connection → lỗi runtime
/*
const pool = createPool({ host: 'db.example.com' });
// Network blip → connection die → queries fail!
*/

// ✅ GOOD: Health check với validation

class DatabaseHealthChecker {
  private isHealthy = true;
  private lastCheckAt = 0;

  constructor(
    private readonly dataSource: any,
    private readonly checkIntervalMs: number = 30_000,
  ) {}

  async check(): Promise<HealthStatus> {
    const now = Date.now();
    if (now - this.lastCheckAt < this.checkIntervalMs) {
      return { healthy: this.isHealthy, cached: true };
    }

    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;

      this.isHealthy = true;
      this.lastCheckAt = now;

      const poolStatus = this.getPoolMetrics();

      return {
        healthy: true,
        cached: false,
        latencyMs,
        pool: poolStatus,
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastCheckAt = now;

      return {
        healthy: false,
        cached: false,
        error: (error as Error).message,
      };
    }
  }

  private getPoolMetrics(): PoolMetrics {
    const pool = this.dataSource.driver?.master;
    if (!pool) return { total: 0, idle: 0, waiting: 0 };

    return {
      total: pool.totalCount ?? 0,
      idle: pool.idleCount ?? 0,
      waiting: pool.waitingCount ?? 0,
    };
  }
}

interface HealthStatus {
  healthy: boolean;
  cached: boolean;
  latencyMs?: number;
  pool?: PoolMetrics;
  error?: string;
}

interface PoolMetrics {
  total: number;
  idle: number;
  waiting: number;
}

// ═══════════════════════════════════════════
// Rule 3.4: Read Replica Setup
// ═══════════════════════════════════════════

// ❌ BAD: Tất cả queries đều hit master → master quá tải
/*
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'master-db.example.com',
  // 80% reads + 20% writes all hit master
});
*/

// ✅ GOOD: Read replica cho read-heavy workload
/*
TypeOrmModule.forRoot({
  type: 'postgres',
  replication: {
    master: {
      host: process.env.DB_MASTER_HOST,
      port: parseInt(process.env.DB_MASTER_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    slaves: [
      {
        host: process.env.DB_REPLICA1_HOST,
        port: parseInt(process.env.DB_REPLICA1_PORT || '5432'),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      {
        host: process.env.DB_REPLICA2_HOST,
        port: parseInt(process.env.DB_REPLICA2_PORT || '5432'),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
    ],
  },
});

// TypeORM tự route:
// - SELECT → slave (round-robin)
// - INSERT/UPDATE/DELETE → master
// - Transaction → master
*/

// ═══════════════════════════════════════════
// Rule 3.5: Connection Pool Monitoring
// ═══════════════════════════════════════════

// ✅ GOOD: Export pool metrics cho Prometheus/Grafana

class PoolMetricsCollector {
  private readonly metrics: PoolSnapshot[] = [];
  private readonly maxSnapshots = 100;

  collect(dataSource: any): PoolSnapshot {
    const pool = dataSource.driver?.master;
    const snapshot: PoolSnapshot = {
      timestamp: new Date(),
      totalConnections: pool?.totalCount ?? 0,
      idleConnections: pool?.idleCount ?? 0,
      waitingClients: pool?.waitingCount ?? 0,
      utilizationPercent: this.calcUtilization(pool),
    };

    this.metrics.push(snapshot);
    if (this.metrics.length > this.maxSnapshots) {
      this.metrics.shift();
    }

    // Alert nếu pool > 80% utilized
    if (snapshot.utilizationPercent > 80) {
      console.warn(
        `[DB Pool] High utilization: ${snapshot.utilizationPercent}% ` +
        `(${snapshot.totalConnections - snapshot.idleConnections}/${snapshot.totalConnections} active)`,
      );
    }

    return snapshot;
  }

  private calcUtilization(pool: any): number {
    if (!pool?.totalCount) return 0;
    const active = pool.totalCount - (pool.idleCount ?? 0);
    return Math.round((active / pool.totalCount) * 100);
  }

  getRecentMetrics(count: number = 10): PoolSnapshot[] {
    return this.metrics.slice(-count);
  }
}

interface PoolSnapshot {
  timestamp: Date;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  utilizationPercent: number;
}

export {
  calculateOptimalPoolSize,
  DatabaseHealthChecker,
  PoolMetricsCollector,
  type PoolSizeConfig,
  type HealthStatus,
  type PoolMetrics,
  type PoolSnapshot,
};
