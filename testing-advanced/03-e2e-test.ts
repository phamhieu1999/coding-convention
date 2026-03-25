/**
 * ============================================
 * TESTING ADVANCED #3: END-TO-END (E2E) TESTS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Test full request lifecycle — HTTP request → response
 * 2. Supertest + NestJS TestingModule
 * 3. Test authentication flow end-to-end
 * 4. Seed data trước test, cleanup sau
 * 5. Test error responses + status codes
 * 6. Test middleware, guards, pipes hoạt động đúng
 */

// ═══════════════════════════════════════════
// Rule 3.1: E2E Test Setup
// ═══════════════════════════════════════════

// ❌ BAD: Không có proper setup/teardown
/*
describe('UsersController', () => {
  it('should get users', async () => {
    const res = await fetch('http://localhost:3000/users');
    // Hard-coded URL, no test isolation, depends on running server!
  });
});
*/

// ✅ GOOD: Proper E2E setup with Supertest
const e2eSetup = `
describe('UsersController (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({ send: jest.fn() })  // Mock external services
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as production
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Seed admin user for authenticated tests
    authToken = await seedAdminAndGetToken(app);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  afterEach(async () => {
    // Clean test data but keep seed data
    await dataSource.query('DELETE FROM "order"');
    await dataSource.query('DELETE FROM "user" WHERE role != \\'admin\\'');
  });
});
`;

// ═══════════════════════════════════════════
// Rule 3.2: CRUD E2E Tests
// ═══════════════════════════════════════════

// ✅ GOOD: Full CRUD lifecycle test
const crudE2eTest = `
describe('POST /users', () => {
  it('should create user and return 201', () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', \`Bearer \${authToken}\`)
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecureP@ss123',
        role: 'user',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: 'John Doe',
            email: 'john@example.com',
          }),
        );
        // Should NOT expose password
        expect(res.body.data).not.toHaveProperty('password');
      });
  });

  it('should return 409 for duplicate email', async () => {
    // Arrange — create first user
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', \`Bearer \${authToken}\`)
      .send({ name: 'First', email: 'dup@test.com', password: 'P@ss123' })
      .expect(201);

    // Act — create duplicate
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', \`Bearer \${authToken}\`)
      .send({ name: 'Second', email: 'dup@test.com', password: 'P@ss456' })
      .expect(409)
      .expect((res) => {
        expect(res.body.message).toContain('already exists');
      });
  });

  it('should return 400 for invalid input', () => {
    return request(app.getHttpServer())
      .post('/users')
      .set('Authorization', \`Bearer \${authToken}\`)
      .send({
        name: '',           // Too short
        email: 'not-email', // Invalid email
        // Missing password
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBeInstanceOf(Array);
        expect(res.body.message.length).toBeGreaterThanOrEqual(2);
      });
  });
});

describe('GET /users', () => {
  it('should return paginated users', async () => {
    // Seed 15 users
    for (let i = 0; i < 15; i++) {
      await seedUser(app, { email: \`user\${i}@test.com\` });
    }

    return request(app.getHttpServer())
      .get('/users?page=1&limit=10')
      .set('Authorization', \`Bearer \${authToken}\`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(10);
        expect(res.body.meta).toEqual(
          expect.objectContaining({
            page: 1,
            limit: 10,
            totalItems: expect.any(Number),
            totalPages: 2,
          }),
        );
      });
  });

  it('should return 401 without auth token', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(401);
  });
});

describe('GET /users/:id', () => {
  it('should return user by ID', async () => {
    const created = await seedUser(app, { name: 'FindMe' });

    return request(app.getHttpServer())
      .get(\`/users/\${created.id}\`)
      .set('Authorization', \`Bearer \${authToken}\`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.name).toBe('FindMe');
      });
  });

  it('should return 404 for non-existent user', () => {
    return request(app.getHttpServer())
      .get('/users/nonexistent-uuid')
      .set('Authorization', \`Bearer \${authToken}\`)
      .expect(404);
  });
});

describe('DELETE /users/:id', () => {
  it('should soft delete user and return 200', async () => {
    const created = await seedUser(app);

    await request(app.getHttpServer())
      .delete(\`/users/\${created.id}\`)
      .set('Authorization', \`Bearer \${authToken}\`)
      .expect(200);

    // Verify soft deleted
    return request(app.getHttpServer())
      .get(\`/users/\${created.id}\`)
      .set('Authorization', \`Bearer \${authToken}\`)
      .expect(404);
  });
});
`;

// ═══════════════════════════════════════════
// Rule 3.3: Authentication E2E Tests
// ═══════════════════════════════════════════

// ✅ GOOD: Full auth flow
const authE2eTest = `
describe('Auth Flow (E2E)', () => {
  it('should register → login → access protected route', async () => {
    // 1. Register
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'New User',
        email: 'new@example.com',
        password: 'SecureP@ss123',
      })
      .expect(201);

    // 2. Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'new@example.com',
        password: 'SecureP@ss123',
      })
      .expect(200);

    expect(loginRes.body.data).toHaveProperty('accessToken');
    expect(loginRes.body.data).toHaveProperty('refreshToken');

    const { accessToken } = loginRes.body.data;

    // 3. Access protected route
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', \`Bearer \${accessToken}\`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.email).toBe('new@example.com');
      });
  });

  it('should reject expired token', async () => {
    const expiredToken = generateExpiredToken();

    return request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', \`Bearer \${expiredToken}\`)
      .expect(401);
  });
});
`;

// ═══════════════════════════════════════════
// Rule 3.4: Seed Helpers
// ═══════════════════════════════════════════

// ✅ GOOD: Reusable seed functions
const seedHelpers = `
// test/helpers/seed.ts
export async function seedUser(
  app: INestApplication,
  overrides: Partial<CreateUserDto> = {},
): Promise<User> {
  const dataSource = app.get<DataSource>(DataSource);
  const repo = dataSource.getRepository(User);

  const user = repo.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? \`test-\${Date.now()}@example.com\`,
    password: await hash(overrides.password ?? 'P@ssword123', 10),
    role: overrides.role ?? 'user',
  });

  return repo.save(user);
}

export async function seedAdminAndGetToken(
  app: INestApplication,
): Promise<string> {
  await seedUser(app, {
    email: 'admin@test.com',
    password: 'AdminP@ss123',
    role: 'admin',
  });

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminP@ss123' });

  return res.body.data.accessToken;
}
`;

// ═══════════════════════════════════════════
// Rule 3.5: E2E Test Checklist
// ═══════════════════════════════════════════

const e2eTestChecklist = {
  mustTest: [
    'Full CRUD lifecycle per resource',
    'Authentication — register, login, token refresh',
    'Authorization — role-based access',
    'Validation — invalid input → 400',
    'Not found — invalid ID → 404',
    'Pagination — page, limit, meta',
    'Error responses — consistent format',
  ],
  bestPractices: [
    'Apply same middleware as production (pipes, filters, guards)',
    'Mock only external services (email, payment, SMS)',
    'Use seed helpers for test data',
    'Clean data between tests',
    'Test response structure, not just status code',
    'Timeout: set jest timeout > default for slow DB operations',
  ],
};

export {
  e2eSetup,
  crudE2eTest,
  authE2eTest,
  seedHelpers,
  e2eTestChecklist,
};
