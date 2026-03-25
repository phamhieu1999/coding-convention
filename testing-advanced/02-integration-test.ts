/**
 * ============================================
 * TESTING ADVANCED #2: INTEGRATION TESTS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Test real interaction giữa các components
 * 2. Dùng TestingModule với real providers (hoặc in-memory DB)
 * 3. Test database queries thực tế — không mock repository
 * 4. Isolate tests — mỗi test tự setup/teardown data
 * 5. Test containers cho consistent environment
 * 6. Transaction rollback để cleanup data
 */

// ═══════════════════════════════════════════
// Rule 2.1: Integration Test với TestingModule
// ═══════════════════════════════════════════

// ❌ BAD: Mock repository trong integration test → không test thật
/*
describe('UserService Integration', () => {
  it('should create user', async () => {
    mockRepo.save.mockResolvedValue(mockUser);
    // This is a UNIT test, not integration!
  });
});
*/

// ✅ GOOD: Real DB connection with TestingModule
const integrationSetup = `
describe('UserService (Integration)', () => {
  let app: INestApplication;
  let service: UserService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // In-memory SQLite for fast tests
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Profile, Role],
          synchronize: true,   // Auto-create tables
          dropSchema: true,    // Clean state
        }),
        TypeOrmModule.forFeature([User, Profile, Role]),
        UserModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    service = module.get<UserService>(UserService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  // Clean data between tests
  afterEach(async () => {
    await dataSource.query('DELETE FROM profile');
    await dataSource.query('DELETE FROM user');
  });
});
`;

// ═══════════════════════════════════════════
// Rule 2.2: Testing Real Database Operations
// ═══════════════════════════════════════════

// ✅ GOOD: Test actual DB queries
const dbIntegrationTest = `
describe('createUser', () => {
  it('should persist user to database with hashed password', async () => {
    // Arrange
    const dto: CreateUserDto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'P@ssword123',
    };

    // Act
    const result = await service.createUser(dto);

    // Assert — verify in DB
    const dbUser = await dataSource.getRepository(User).findOne({
      where: { email: 'jane@example.com' },
    });

    expect(dbUser).toBeDefined();
    expect(dbUser!.name).toBe('Jane Doe');
    expect(dbUser!.password).not.toBe('P@ssword123'); // Should be hashed
    expect(result.id).toBe(dbUser!.id);
  });

  it('should throw ConflictException for duplicate email', async () => {
    // Arrange — seed existing user
    await dataSource.getRepository(User).save({
      name: 'Existing',
      email: 'duplicate@example.com',
      password: 'hashed',
    });

    // Act & Assert
    await expect(
      service.createUser({
        name: 'New User',
        email: 'duplicate@example.com',
        password: 'P@ss123',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
`;

// ═══════════════════════════════════════════
// Rule 2.3: Transaction Rollback for Cleanup
// ═══════════════════════════════════════════

// ❌ BAD: DELETE statements to cleanup → slow, error-prone
/*
afterEach(async () => {
  await repo.delete({});                 // May miss related tables
  await profileRepo.delete({});          // Order matters for FK!
});
*/

// ✅ GOOD: Transaction rollback pattern
const transactionRollbackPattern = `
describe('OrderService (Integration)', () => {
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Point service to use this query runner's manager
    jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner);
  });

  afterEach(async () => {
    // Rollback — undo all changes from this test
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  it('should create order with items', async () => {
    const order = await service.createOrder(orderDto);
    expect(order.items).toHaveLength(3);
    expect(order.total).toBe(299.97);
    // After test: rollback → no data pollution
  });
});
`;

// ═══════════════════════════════════════════
// Rule 2.4: Test Containers
// ═══════════════════════════════════════════

// ✅ GOOD: Docker-based test containers cho production-like environment
const testContainerExample = `
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('UserService (TestContainers)', () => {
  let container: StartedTestContainer;
  let app: INestApplication;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer('postgres:15')
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'test_pass',
      })
      .withExposedPorts(5432)
      .start();

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getMappedPort(5432),
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
          entities: [User, Profile],
          synchronize: true,
        }),
        UserModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }, 60_000); // Container startup takes time

  afterAll(async () => {
    await app.close();
    await container.stop();
  });
});
`;

// ═══════════════════════════════════════════
// Rule 2.5: Testing with Redis
// ═══════════════════════════════════════════

// ✅ GOOD: Redis test container
const redisTestExample = `
describe('CacheService (Integration)', () => {
  let redisContainer: StartedTestContainer;
  let cacheService: CacheService;

  beforeAll(async () => {
    redisContainer = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();

    const module = await Test.createTestingModule({
      imports: [
        CacheModule.register({
          store: 'ioredis',
          host: redisContainer.getHost(),
          port: redisContainer.getMappedPort(6379),
        }),
      ],
      providers: [CacheService],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    await redisContainer.stop();
  });

  it('should cache and retrieve value', async () => {
    await cacheService.set('key1', { name: 'test' }, 60);
    const result = await cacheService.get('key1');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return null for expired key', async () => {
    await cacheService.set('expires', 'data', 1); // 1 second TTL
    await new Promise(r => setTimeout(r, 1500));
    const result = await cacheService.get('expires');
    expect(result).toBeNull();
  });
});
`;

// ═══════════════════════════════════════════
// Rule 2.6: Integration Test Checklist
// ═══════════════════════════════════════════

const integrationTestChecklist = {
  mustTest: [
    'Database CRUD operations — actual queries',
    'Transactions — commit & rollback behavior',
    'Unique constraints — duplicate detection',
    'Cascade operations — relations',
    'Cache integration — set/get/invalidate',
    'Queue integration — job dispatch & processing',
  ],
  doNotTest: [
    'Business logic in isolation — that is unit test',
    'Third-party API calls — use contract tests',
    'UI rendering — that is e2e',
  ],
  bestPractices: [
    'Use in-memory DB (SQLite) for speed',
    'Use test containers for production parity',
    'Isolate test data — no shared state',
    'Deterministic seed data — reproducible results',
  ],
};

export {
  integrationSetup,
  dbIntegrationTest,
  transactionRollbackPattern,
  testContainerExample,
  redisTestExample,
  integrationTestChecklist,
};
