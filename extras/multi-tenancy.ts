/**
 * ============================================
 * MULTI-TENANCY PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Row-level tenancy — cùng DB, filter bằng tenantId
 * 2. Schema-level tenancy — mỗi tenant 1 schema
 * 3. Database-level tenancy — mỗi tenant 1 database
 * 4. Tenant detection — từ subdomain, header, JWT
 * 5. Data isolation — không bao giờ leak data cross-tenant
 * 6. Middleware tự động inject tenantId
 */

// ═══════════════════════════════════════════
// Rule 1: So sánh các chiến lược
// ═══════════════════════════════════════════

const MULTI_TENANCY_STRATEGIES = {
  rowLevel: {
    description: 'Cùng database, cùng table, filter bằng tenant_id column',
    pros: ['Đơn giản nhất', 'Ít resource', 'Shared connections'],
    cons: ['Risk data leak nếu quên WHERE', 'Noisy neighbor', 'Khó backup per tenant'],
    bestFor: 'SaaS startups, < 1000 tenants, simple data model',
  },
  schemaLevel: {
    description: 'Cùng database, mỗi tenant 1 schema (PostgreSQL)',
    pros: ['Isolation tốt hơn row-level', 'Dễ backup per tenant', 'Tenant-specific indexes'],
    cons: ['Schema migration phải apply cho mọi schemas', 'Connection pool phức tạp'],
    bestFor: 'Medium SaaS, tenants cần customization, compliance requirements',
  },
  databaseLevel: {
    description: 'Mỗi tenant 1 database riêng',
    pros: ['Isolation cao nhất', 'Dễ scale', 'Dễ backup/restore', 'Compliance'],
    cons: ['Tốn resource nhất', 'Connection management phức tạp', 'Hard to query cross-tenant'],
    bestFor: 'Enterprise SaaS, high compliance, tenants trả tiền nhiều',
  },
};

// ═══════════════════════════════════════════
// Rule 2: Row-Level Tenancy (Phổ biến nhất)
// ═══════════════════════════════════════════

// ❌ BAD: Quên filter tenantId → data leak!
/*
async findAll(): Promise<Product[]> {
  return this.productRepo.find(); // TẤT CẢ products, mọi tenants!
}
*/

// ✅ GOOD: Tenant-aware base entity + repository

interface TenantAware {
  tenantId: string;
}

const tenantEntityExample = `
// base-tenant.entity.ts
@Entity()
export abstract class BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// product.entity.ts
@Entity('products')
export class ProductEntity extends BaseTenantEntity {
  @Column()
  name: string;

  @Column('decimal')
  price: number;
}
`;

// ═══════════════════════════════════════════
// Rule 3: Tenant Context Middleware
// ═══════════════════════════════════════════

// ✅ GOOD: Auto-detect tenant from request
const tenantMiddlewareExample = `
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Strategy 1: Subdomain → acme.myapp.com → tenantId = "acme"
    const subdomain = req.hostname.split('.')[0];

    // Strategy 2: Header → X-Tenant-ID: acme
    const headerTenant = req.headers['x-tenant-id'] as string;

    // Strategy 3: JWT claim → { tenantId: "acme" }
    const jwtTenant = req.user?.tenantId;

    const tenantId = jwtTenant || headerTenant || subdomain;

    if (!tenantId || tenantId === 'www') {
      throw new BadRequestException('Tenant not identified');
    }

    // Store in request context
    req.tenantId = tenantId;
    next();
  }
}
`;

// ═══════════════════════════════════════════
// Rule 4: Tenant-Scoped Repository
// ═══════════════════════════════════════════

// ✅ GOOD: Repository tự động filter theo tenant
class TenantScopedRepository<T extends TenantAware & { id: string }> {
  constructor(
    private readonly items: T[],
    private readonly tenantId: string,
  ) {}

  findAll(): T[] {
    return this.items.filter(i => i.tenantId === this.tenantId);
  }

  findById(id: string): T | undefined {
    return this.items.find(i => i.id === id && i.tenantId === this.tenantId);
  }

  create(data: Omit<T, 'tenantId'>): T {
    const item = { ...data, tenantId: this.tenantId } as T;
    this.items.push(item);
    return item;
  }

  // ⚠️ CRITICAL: Always include tenantId in WHERE clause
  update(id: string, data: Partial<T>): T | undefined {
    const item = this.findById(id);
    if (!item) return undefined;
    Object.assign(item, data);
    return item;
  }

  delete(id: string): boolean {
    const index = this.items.findIndex(
      i => i.id === id && i.tenantId === this.tenantId,
    );
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
}

// ═══════════════════════════════════════════
// Rule 5: Database-Level Isolation
// ═══════════════════════════════════════════

// ✅ GOOD: Dynamic datasource per tenant
const databasePerTenantExample = `
@Injectable()
export class TenantConnectionManager {
  private connections = new Map<string, DataSource>();

  async getConnection(tenantId: string): Promise<DataSource> {
    // Check cache
    if (this.connections.has(tenantId)) {
      const conn = this.connections.get(tenantId)!;
      if (conn.isInitialized) return conn;
    }

    // Look up tenant config
    const tenantConfig = await this.tenantConfigRepo.findOne({
      where: { tenantId },
    });
    if (!tenantConfig) throw new NotFoundException('Tenant not found');

    // Create connection
    const dataSource = new DataSource({
      type: 'postgres',
      host: tenantConfig.dbHost,
      port: tenantConfig.dbPort,
      database: tenantConfig.dbName,
      username: tenantConfig.dbUsername,
      password: tenantConfig.dbPassword,
      entities: [/* shared entities */],
      synchronize: false,
    });

    await dataSource.initialize();
    this.connections.set(tenantId, dataSource);
    return dataSource;
  }

  // Cleanup idle connections
  async cleanupIdleConnections(maxIdleMs = 30 * 60 * 1000): Promise<void> {
    for (const [tenantId, conn] of this.connections) {
      if (conn.isInitialized) {
        // Check if idle > maxIdleMs → destroy
        await conn.destroy();
        this.connections.delete(tenantId);
      }
    }
  }
}
`;

// ═══════════════════════════════════════════
// Rule 6: Security Checklist
// ═══════════════════════════════════════════

const TENANT_SECURITY_CHECKLIST = [
  '✅ Every query MUST include tenantId filter',
  '✅ Global query filter / middleware auto-injects tenantId',
  '✅ API responses never include tenantId in URLs',
  '✅ Admin endpoints isolated from tenant endpoints',
  '✅ Tenant cannot access other tenant data (test this!)',
  '✅ Background jobs must include tenant context',
  '✅ Caching keys must include tenantId prefix',
  '✅ File uploads must be tenant-scoped (S3 prefix)',
  '✅ Logs must include tenantId for debugging',
  '✅ Rate limiting per tenant (not just per IP)',
];

export {
  TenantScopedRepository,
  MULTI_TENANCY_STRATEGIES,
  TENANT_SECURITY_CHECKLIST,
  tenantEntityExample,
  tenantMiddlewareExample,
  databasePerTenantExample,
  type TenantAware,
};
