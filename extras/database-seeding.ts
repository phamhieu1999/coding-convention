/**
 * ============================================
 * DATABASE SEEDING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Seed data tách biệt cho dev / staging / testing
 * 2. Idempotent — chạy nhiều lần không duplicate
 * 3. Realistic data — dùng faker cho dev
 * 4. Typed seed factories — type-safe, reusable
 * 5. Seed ordering — respect foreign key dependencies
 * 6. Cleanup — dễ reset data
 */

// ═══════════════════════════════════════════
// Rule 1: Seed Runner Architecture
// ═══════════════════════════════════════════

// ❌ BAD: SQL file lẫn lộn, không idempotent
/*
INSERT INTO users (id, name, email) VALUES ('1', 'Admin', 'admin@test.com');
-- Chạy lần 2 → duplicate key error!
*/

// ✅ GOOD: Structured seed runner
interface SeederInterface {
  name: string;
  order: number;
  run(): Promise<void>;
  clean(): Promise<void>;
}

class SeedRunner {
  private seeders: SeederInterface[] = [];

  register(seeder: SeederInterface): void {
    this.seeders.push(seeder);
    this.seeders.sort((a, b) => a.order - b.order); // Respect dependencies
  }

  async runAll(): Promise<void> {
    console.log('🌱 Starting database seeding...\n');

    for (const seeder of this.seeders) {
      const start = Date.now();
      await seeder.run();
      const duration = Date.now() - start;
      console.log(`  ✅ ${seeder.name} (${duration}ms)`);
    }

    console.log('\n🌱 Seeding complete!');
  }

  async cleanAll(): Promise<void> {
    console.log('🧹 Cleaning database...\n');

    // Reverse order — delete children before parents
    const reversed = [...this.seeders].reverse();
    for (const seeder of reversed) {
      await seeder.clean();
      console.log(`  🗑️  ${seeder.name} cleaned`);
    }

    console.log('\n🧹 Clean complete!');
  }

  async resetAll(): Promise<void> {
    await this.cleanAll();
    await this.runAll();
  }
}

// ═══════════════════════════════════════════
// Rule 2: Typed Seed Factories
// ═══════════════════════════════════════════

// ✅ GOOD: Factory functions với realistic data

let seedCounter = 0;

interface SeedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'moderator';
  isActive: boolean;
}

interface SeedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  isActive: boolean;
}

interface SeedOrder {
  id: string;
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  status: 'pending' | 'paid' | 'shipped' | 'delivered';
  total: number;
}

function seedUser(overrides: Partial<SeedUser> = {}): SeedUser {
  seedCounter++;
  return {
    id: `user-${seedCounter}`,
    name: `User ${seedCounter}`,
    email: `user${seedCounter}@example.com`,
    password: '$2b$10$hashedpassword', // Pre-hashed "Password123!"
    role: 'user',
    isActive: true,
    ...overrides,
  };
}

function seedProduct(overrides: Partial<SeedProduct> = {}): SeedProduct {
  seedCounter++;
  const names = ['Laptop Pro', 'Wireless Mouse', 'Keyboard', 'Monitor 4K', 'USB-C Hub', 'Webcam HD'];
  return {
    id: `product-${seedCounter}`,
    name: names[seedCounter % names.length],
    description: `High quality ${names[seedCounter % names.length]}`,
    price: Math.floor(Math.random() * 900 + 100),
    stock: Math.floor(Math.random() * 100 + 10),
    categoryId: 'cat-electronics',
    isActive: true,
    ...overrides,
  };
}

function seedOrder(userId: string, products: SeedProduct[], overrides: Partial<SeedOrder> = {}): SeedOrder {
  seedCounter++;
  const items = products.slice(0, 2).map(p => ({
    productId: p.id,
    quantity: Math.floor(Math.random() * 3 + 1),
    price: p.price,
  }));
  return {
    id: `order-${seedCounter}`,
    userId,
    items,
    status: 'paid',
    total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// Rule 3: Concrete Seeders
// ═══════════════════════════════════════════

// ✅ GOOD: Idempotent seeder — upsert, not insert
class UserSeeder implements SeederInterface {
  name = 'UserSeeder';
  order = 1; // First — no dependencies

  constructor(private readonly repo: any) {}

  async run(): Promise<void> {
    const users = [
      seedUser({ id: 'admin-1', name: 'Admin', email: 'admin@myapp.com', role: 'admin' }),
      seedUser({ id: 'mod-1', name: 'Moderator', email: 'mod@myapp.com', role: 'moderator' }),
      ...Array.from({ length: 10 }, (_, i) =>
        seedUser({ id: `user-${i + 1}`, email: `user${i + 1}@myapp.com` }),
      ),
    ];

    // Upsert — idempotent
    for (const user of users) {
      await this.repo.save(user); // TypeORM upsert on primary key
    }
  }

  async clean(): Promise<void> {
    await this.repo.delete({});
  }
}

class ProductSeeder implements SeederInterface {
  name = 'ProductSeeder';
  order = 2; // After categories

  constructor(private readonly repo: any) {}

  async run(): Promise<void> {
    const products = Array.from({ length: 20 }, (_, i) =>
      seedProduct({ id: `prod-${i + 1}` }),
    );

    for (const product of products) {
      await this.repo.save(product);
    }
  }

  async clean(): Promise<void> {
    await this.repo.delete({});
  }
}

class OrderSeeder implements SeederInterface {
  name = 'OrderSeeder';
  order = 3; // After users and products

  constructor(
    private readonly orderRepo: any,
    private readonly userRepo: any,
    private readonly productRepo: any,
  ) {}

  async run(): Promise<void> {
    const users = await this.userRepo.find({ where: { role: 'user' } });
    const products = await this.productRepo.find();

    for (const user of users.slice(0, 5)) {
      const order = seedOrder(user.id, products, { id: `order-${user.id}` });
      await this.orderRepo.save(order);
    }
  }

  async clean(): Promise<void> {
    await this.orderRepo.delete({});
  }
}

// ═══════════════════════════════════════════
// Rule 4: Environment-Specific Seeds
// ═══════════════════════════════════════════

// ✅ GOOD: Different data per environment

const SEED_CONFIG = {
  development: {
    userCount: 50,
    productCount: 100,
    orderCount: 200,
    includeTestAccounts: true,
    includeRealisticData: true,
  },
  staging: {
    userCount: 20,
    productCount: 50,
    orderCount: 100,
    includeTestAccounts: true,
    includeRealisticData: true,
  },
  test: {
    userCount: 5,
    productCount: 10,
    orderCount: 10,
    includeTestAccounts: true,
    includeRealisticData: false, // Deterministic for tests
  },
  production: {
    userCount: 0,    // KHÔNG seed users
    productCount: 0, // KHÔNG seed products
    orderCount: 0,
    includeTestAccounts: false,
    includeRealisticData: false,
    // Chỉ seed: roles, permissions, categories, configs
  },
} as const;

// ═══════════════════════════════════════════
// Rule 5: CLI Script
// ═══════════════════════════════════════════

// ✅ GOOD: npm run seed / npm run seed:reset
/*
// src/database/seeds/run-seed.ts
async function main() {
  const dataSource = await createDataSource();
  await dataSource.initialize();

  const runner = new SeedRunner();
  runner.register(new UserSeeder(dataSource.getRepository('User')));
  runner.register(new ProductSeeder(dataSource.getRepository('Product')));
  runner.register(new OrderSeeder(
    dataSource.getRepository('Order'),
    dataSource.getRepository('User'),
    dataSource.getRepository('Product'),
  ));

  const command = process.argv[2];
  switch (command) {
    case 'clean':
      await runner.cleanAll();
      break;
    case 'reset':
      await runner.resetAll();
      break;
    default:
      await runner.runAll();
  }

  await dataSource.destroy();
}

main().catch(console.error);

// package.json scripts:
// "seed": "ts-node src/database/seeds/run-seed.ts"
// "seed:clean": "ts-node src/database/seeds/run-seed.ts clean"
// "seed:reset": "ts-node src/database/seeds/run-seed.ts reset"
*/

export {
  SeedRunner,
  UserSeeder,
  ProductSeeder,
  OrderSeeder,
  seedUser,
  seedProduct,
  seedOrder,
  SEED_CONFIG,
  type SeederInterface,
  type SeedUser,
  type SeedProduct,
  type SeedOrder,
};
