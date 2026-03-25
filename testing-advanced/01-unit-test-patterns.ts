/**
 * ============================================
 * TESTING ADVANCED #1: UNIT TEST PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Test behavior, không test implementation
 * 2. AAA pattern — Arrange, Act, Assert
 * 3. Mock external dependencies — isolate unit under test
 * 4. Descriptive test names — nói rõ scenario + expected result
 * 5. One assertion per concept
 * 6. Test doubles: Mock vs Stub vs Spy — dùng đúng loại
 */

// ═══════════════════════════════════════════
// Rule 1.1: Descriptive Test Names
// ═══════════════════════════════════════════

// ❌ BAD: Tên test mơ hồ
/*
describe('UserService', () => {
  it('should work', () => { ... });
  it('test create', () => { ... });
  it('error case', () => { ... });
});
*/

// ✅ GOOD: Tên test mô tả rõ scenario + expected result
/*
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user and return user without password', () => { ... });
    it('should throw ConflictException when email already exists', () => { ... });
    it('should hash password before saving to database', () => { ... });
  });

  describe('findById', () => {
    it('should return user when valid ID provided', () => { ... });
    it('should throw NotFoundException when user does not exist', () => { ... });
  });
});
*/

// ═══════════════════════════════════════════
// Rule 1.2: AAA Pattern (Arrange-Act-Assert)
// ═══════════════════════════════════════════

// ❌ BAD: Mixed setup, action, assertion
/*
it('test', async () => {
  const service = new UserService(repo);
  expect(await service.create({ name: 'John', email: 'john@test.com', password: '123' }))
    .toEqual(expect.objectContaining({ name: 'John' }));
});
*/

// ✅ GOOD: Clear AAA separation
const exampleTest = `
it('should create user and return user without password', async () => {
  // Arrange
  const createDto: CreateUserDto = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'SecureP@ss123',
  };
  const expectedUser = { id: 'uuid-1', name: 'John Doe', email: 'john@example.com' };
  mockUserRepo.save.mockResolvedValue({ ...expectedUser, password: 'hashed' });
  mockUserRepo.findOne.mockResolvedValue(null); // No existing user

  // Act
  const result = await userService.createUser(createDto);

  // Assert
  expect(result).toEqual(expectedUser);
  expect(result).not.toHaveProperty('password');
  expect(mockUserRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'John Doe', email: 'john@example.com' }),
  );
});
`;

// ═══════════════════════════════════════════
// Rule 1.3: Mock vs Stub vs Spy
// ═══════════════════════════════════════════

// Stub: Returns canned data — kiểm tra indirect input
// Mock: Verifies interactions — kiểm tra indirect output
// Spy: Wraps real implementation — theo dõi calls

// ❌ BAD: Mock everything, kể cả internal logic
/*
jest.spyOn(service, 'validateEmail'); // Don't spy on private/internal methods!
jest.spyOn(service, 'hashPassword');  // This is implementation detail
*/

// ✅ GOOD: Mock chỉ external dependencies

const mockExternalDepsExample = `
describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockPaymentGateway: jest.Mocked<PaymentGateway>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    // Stubs — provide canned responses
    mockOrderRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as any;

    // Mock — verify interactions
    mockPaymentGateway = {
      charge: jest.fn(),
      refund: jest.fn(),
    } as any;

    mockEmailService = {
      sendOrderConfirmation: jest.fn(),
    } as any;

    orderService = new OrderService(
      mockOrderRepo,
      mockPaymentGateway,
      mockEmailService,
    );
  });

  it('should charge payment and save order', async () => {
    // Arrange — stub returns
    mockPaymentGateway.charge.mockResolvedValue({ transactionId: 'tx-123' });
    mockOrderRepo.save.mockResolvedValue({ id: 'order-1', status: 'paid' });

    // Act
    const result = await orderService.placeOrder(orderDto);

    // Assert — verify mock interactions
    expect(mockPaymentGateway.charge).toHaveBeenCalledWith({
      amount: 100,
      currency: 'USD',
    });
    expect(mockOrderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', transactionId: 'tx-123' }),
    );
  });
});
`;

// ═══════════════════════════════════════════
// Rule 1.4: Testing Error Cases
// ═══════════════════════════════════════════

// ❌ BAD: Chỉ test happy path
/*
it('should return user', async () => {
  mockRepo.findOne.mockResolvedValue(mockUser);
  const result = await service.findById('1');
  expect(result).toEqual(mockUser);
});
// Missing: What if user not found? What if DB throws?
*/

// ✅ GOOD: Test cả error paths
const errorTestExample = `
describe('findById', () => {
  it('should return user when found', async () => {
    mockRepo.findOne.mockResolvedValue(mockUser);
    const result = await service.findById('uuid-1');
    expect(result).toEqual(mockUser);
  });

  it('should throw NotFoundException when user not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('nonexistent'))
      .rejects.toThrow(NotFoundException);
  });

  it('should propagate database errors', async () => {
    mockRepo.findOne.mockRejectedValue(new Error('Connection lost'));
    await expect(service.findById('uuid-1'))
      .rejects.toThrow('Connection lost');
  });
});
`;

// ═══════════════════════════════════════════
// Rule 1.5: NestJS Testing Module
// ═══════════════════════════════════════════

// ✅ GOOD: Proper NestJS test setup
const nestjsTestSetup = `
describe('UserService', () => {
  let service: UserService;
  let mockRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    mockRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
`;

// ═══════════════════════════════════════════
// Rule 1.6: Test Coverage Guidelines
// ═══════════════════════════════════════════

// ✅ GOOD: Focus on meaningful coverage

const coverageGuidelines = {
  priorities: [
    'Business logic in services — 90%+',
    'Utility / helper functions — 95%+',
    'Guards, pipes, interceptors — 80%+',
    'Controllers — 70%+ (mostly integration tests)',
    'DTOs / entities — skip (no logic)',
  ],
  antiPatterns: [
    'Testing getters/setters — no value',
    'Testing framework code — trust NestJS',
    'Testing third-party libraries — trust them',
    '100% coverage as a goal — focus on quality',
  ],
};

export {
  exampleTest,
  mockExternalDepsExample,
  errorTestExample,
  nestjsTestSetup,
  coverageGuidelines,
};
