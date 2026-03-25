/**
 * ============================================
 * TESTING ADVANCED #4: TEST FIXTURES
 * ============================================
 *
 * Nguyên tắc:
 * 1. Factory pattern — tạo test data nhanh, flexible
 * 2. Builder pattern — complex objects step by step
 * 3. Fixture files — static seed data cho integration tests
 * 4. Faker/casual — random nhưng realistic data
 * 5. Tránh magic values — dùng named constants
 * 6. Shared fixtures — DRY across test suites
 */

// ═══════════════════════════════════════════
// Rule 4.1: Factory Pattern
// ═══════════════════════════════════════════

// ❌ BAD: Tạo test data inline, lặp lại khắp nơi
/*
it('test 1', () => {
  const user = { id: '1', name: 'John', email: 'john@test.com', role: 'user', ... };
});
it('test 2', () => {
  const user = { id: '2', name: 'Jane', email: 'jane@test.com', role: 'user', ... };
});
// Repeat 50 times across test files...
*/

// ✅ GOOD: Factory function — DRY, flexible

interface UserData {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
  createdAt: Date;
}

interface OrderData {
  id: string;
  userId: string;
  items: OrderItemData[];
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  createdAt: Date;
}

interface OrderItemData {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

let factoryCounter = 0;

function createUser(overrides: Partial<UserData> = {}): UserData {
  factoryCounter++;
  return {
    id: `user-${factoryCounter}`,
    name: `Test User ${factoryCounter}`,
    email: `user${factoryCounter}@test.com`,
    password: 'HashedP@ss123',
    role: 'user',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createOrder(overrides: Partial<OrderData> = {}): OrderData {
  factoryCounter++;
  const items = overrides.items ?? [createOrderItem()];
  return {
    id: `order-${factoryCounter}`,
    userId: `user-${factoryCounter}`,
    items,
    status: 'pending',
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createOrderItem(overrides: Partial<OrderItemData> = {}): OrderItemData {
  factoryCounter++;
  return {
    productId: `product-${factoryCounter}`,
    name: `Product ${factoryCounter}`,
    quantity: 1,
    price: 29.99,
    ...overrides,
  };
}

// Usage:
// const user = createUser();                           // Default user
// const admin = createUser({ role: 'admin' });         // Admin user
// const order = createOrder({ userId: admin.id });     // Order for admin

// ═══════════════════════════════════════════
// Rule 4.2: Builder Pattern — Complex Objects
// ═══════════════════════════════════════════

// ❌ BAD: Giant object literal cho complex entities
/*
const order = {
  id: '1', userId: '1', items: [...], shipping: {...},
  billing: {...}, discount: {...}, tax: {...}, notes: '...',
  // 20 more fields...
};
*/

// ✅ GOOD: Builder cho step-by-step construction

class UserBuilder {
  private data: UserData;

  constructor() {
    this.data = createUser();
  }

  static create(): UserBuilder {
    return new UserBuilder();
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withRole(role: UserData['role']): this {
    this.data.role = role;
    return this;
  }

  asAdmin(): this {
    this.data.role = 'admin';
    this.data.name = 'Admin User';
    return this;
  }

  asInactive(): this {
    this.data.isActive = false;
    return this;
  }

  build(): UserData {
    return { ...this.data };
  }
}

class OrderBuilder {
  private data: OrderData;

  constructor() {
    this.data = createOrder();
  }

  static create(): OrderBuilder {
    return new OrderBuilder();
  }

  forUser(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withItems(items: OrderItemData[]): this {
    this.data.items = items;
    this.data.total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return this;
  }

  addItem(item: Partial<OrderItemData> = {}): this {
    const newItem = createOrderItem(item);
    this.data.items.push(newItem);
    this.data.total += newItem.price * newItem.quantity;
    return this;
  }

  withStatus(status: OrderData['status']): this {
    this.data.status = status;
    return this;
  }

  asPaid(): this {
    this.data.status = 'paid';
    return this;
  }

  build(): OrderData {
    return { ...this.data };
  }
}

// Usage:
// const admin = UserBuilder.create().asAdmin().withEmail('admin@co.com').build();
// const order = OrderBuilder.create()
//   .forUser(admin.id)
//   .addItem({ name: 'Laptop', price: 999 })
//   .addItem({ name: 'Mouse', price: 29.99, quantity: 2 })
//   .asPaid()
//   .build();

// ═══════════════════════════════════════════
// Rule 4.3: Fixture Presets
// ═══════════════════════════════════════════

// ✅ GOOD: Named presets cho common test scenarios

const FIXTURES = {
  users: {
    admin: (): UserData => createUser({
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'admin',
    }),
    regularUser: (): UserData => createUser({
      name: 'Regular User',
      email: 'user@test.com',
      role: 'user',
    }),
    inactiveUser: (): UserData => createUser({
      name: 'Inactive User',
      email: 'inactive@test.com',
      isActive: false,
    }),
    moderator: (): UserData => createUser({
      name: 'Moderator',
      email: 'mod@test.com',
      role: 'moderator',
    }),
  },
  orders: {
    pending: (): OrderData => createOrder({ status: 'pending' }),
    paid: (): OrderData => createOrder({ status: 'paid' }),
    shipped: (): OrderData => createOrder({ status: 'shipped' }),
    multiItem: (): OrderData => createOrder({
      items: [
        createOrderItem({ name: 'Item 1', price: 10, quantity: 2 }),
        createOrderItem({ name: 'Item 2', price: 25, quantity: 1 }),
        createOrderItem({ name: 'Item 3', price: 5, quantity: 5 }),
      ],
    }),
  },
} as const;

// Usage:
// const admin = FIXTURES.users.admin();
// const paidOrder = FIXTURES.orders.paid();

// ═══════════════════════════════════════════
// Rule 4.4: Database Seeder for Integration Tests
// ═══════════════════════════════════════════

// ✅ GOOD: Seeder class cho integration/e2e tests

class TestSeeder {
  constructor(private readonly dataSource: any) {}

  async seedUsers(count: number = 5): Promise<UserData[]> {
    const users: UserData[] = [];
    const repo = this.dataSource.getRepository('User');

    for (let i = 0; i < count; i++) {
      const user = createUser({ email: `seeded${i}@test.com` });
      await repo.save(user);
      users.push(user);
    }

    return users;
  }

  async seedOrdersForUser(
    userId: string,
    count: number = 3,
  ): Promise<OrderData[]> {
    const orders: OrderData[] = [];
    const repo = this.dataSource.getRepository('Order');

    for (let i = 0; i < count; i++) {
      const order = createOrder({ userId, status: 'paid' });
      await repo.save(order);
      orders.push(order);
    }

    return orders;
  }

  async seedFullScenario(): Promise<SeedResult> {
    const admin = FIXTURES.users.admin();
    const users = await this.seedUsers(5);
    const orders = await this.seedOrdersForUser(users[0].id, 3);

    return { admin, users, orders };
  }

  async cleanAll(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;
    for (const entity of entities) {
      const repo = this.dataSource.getRepository(entity.name);
      await repo.clear();
    }
  }
}

interface SeedResult {
  admin: UserData;
  users: UserData[];
  orders: OrderData[];
}

// ═══════════════════════════════════════════
// Rule 4.5: Avoid Magic Values
// ═══════════════════════════════════════════

// ❌ BAD: Magic values → unclear intent
/*
expect(result.status).toBe(2);          // What is 2?
expect(result.total).toBe(59.98);       // Where does this come from?
expect(result.items.length).toBe(3);    // Why 3?
*/

// ✅ GOOD: Named constants → self-documenting

const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPED: 'shipped',
} as const;

const TEST_PRICES = {
  LAPTOP: 999.99,
  MOUSE: 29.99,
  KEYBOARD: 79.99,
} as const;

const namedConstantsExample = `
it('should calculate order total correctly', () => {
  const order = OrderBuilder.create()
    .addItem({ name: 'Laptop', price: TEST_PRICES.LAPTOP, quantity: 1 })
    .addItem({ name: 'Mouse', price: TEST_PRICES.MOUSE, quantity: 2 })
    .build();

  const expectedTotal = TEST_PRICES.LAPTOP + (TEST_PRICES.MOUSE * 2);
  expect(order.total).toBe(expectedTotal);
  expect(order.items).toHaveLength(2);
  expect(order.status).toBe(ORDER_STATUS.PENDING);
});
`;

// ═══════════════════════════════════════════
// Rule 4.6: Fixture Organization
// ═══════════════════════════════════════════

// ✅ GOOD: Organized test helpers directory structure
/*
test/
├── fixtures/
│   ├── factories/
│   │   ├── user.factory.ts       # createUser, UserBuilder
│   │   ├── order.factory.ts      # createOrder, OrderBuilder
│   │   └── index.ts              # Re-exports all factories
│   ├── presets/
│   │   ├── user.presets.ts       # FIXTURES.users
│   │   ├── order.presets.ts      # FIXTURES.orders
│   │   └── index.ts
│   └── seeders/
│       ├── test.seeder.ts        # TestSeeder class
│       └── index.ts
├── helpers/
│   ├── auth.helper.ts            # seedAdminAndGetToken
│   ├── request.helper.ts         # Wrapper around supertest
│   └── index.ts
├── e2e/
│   ├── users.e2e-spec.ts
│   └── orders.e2e-spec.ts
└── jest.config.ts
*/

export {
  createUser,
  createOrder,
  createOrderItem,
  UserBuilder,
  OrderBuilder,
  TestSeeder,
  FIXTURES,
  ORDER_STATUS,
  TEST_PRICES,
  namedConstantsExample,
  type UserData,
  type OrderData,
  type OrderItemData,
  type SeedResult,
};
