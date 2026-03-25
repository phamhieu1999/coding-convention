/**
 * ============================================
 * NESTJS CONVENTION #1: MODULE STRUCTURE
 * ============================================
 *
 * Nguyên tắc:
 * 1. Mỗi module = 1 bounded context (domain)
 * 2. Barrel exports qua index.ts
 * 3. Tránh circular dependency giữa modules
 * 4. SharedModule cho common providers
 * 5. Feature module tách biệt, self-contained
 * 6. forRoot / forRootAsync cho dynamic modules
 */

// ═══════════════════════════════════════════
// Rule 1.1: Module Organization
// ═══════════════════════════════════════════

// ❌ BAD: Tất cả dồn vào 1 module, không tổ chức
/*
app.module.ts
├── user.controller.ts
├── user.service.ts
├── order.controller.ts
├── order.service.ts
├── payment.controller.ts
├── payment.service.ts
├── email.service.ts
├── sms.service.ts
└── ... 50+ files khác
*/

// ✅ GOOD: Tách theo domain, mỗi module là 1 feature
/*
src/
├── modules/
│   ├── user/
│   │   ├── controllers/
│   │   │   └── user.controller.ts
│   │   ├── services/
│   │   │   └── user.service.ts
│   │   ├── repositories/
│   │   │   └── user.repository.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── interfaces/
│   │   │   └── user.interface.ts
│   │   ├── user.module.ts
│   │   └── index.ts            ← barrel export
│   │
│   ├── order/
│   │   ├── ...
│   │   └── order.module.ts
│   │
│   └── payment/
│       ├── ...
│       └── payment.module.ts
│
├── shared/
│   ├── shared.module.ts
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── filters/
│
└── app.module.ts
*/

// ═══════════════════════════════════════════
// Rule 1.2: Module Declaration
// ═══════════════════════════════════════════

// ❌ BAD: Import quá nhiều, export hết tất cả
/*
@Module({
  imports: [TypeOrmModule.forFeature([User, Order, Payment, Product, Cart])],
  controllers: [UserController, OrderController, PaymentController],
  providers: [UserService, OrderService, PaymentService, EmailService],
  exports: [UserService, OrderService, PaymentService, EmailService],
})
export class EverythingModule {}
*/

// ✅ GOOD: Module gọn, chỉ chứa đúng domain
/*
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    SharedModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
  ],
  exports: [UserService], // Chỉ export những gì module khác cần
})
export class UserModule {}
*/

// ═══════════════════════════════════════════
// Rule 1.3: Barrel Exports (index.ts)
// ═══════════════════════════════════════════

// ❌ BAD: Import trực tiếp từ file sâu bên trong module khác
/*
import { UserService } from '../user/services/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';
*/

// ✅ GOOD: Import qua barrel (index.ts)
/*
// user/index.ts
export { UserService } from './services/user.service';
export { CreateUserDto, UpdateUserDto } from './dto';
export { User } from './entities/user.entity';
export { UserModule } from './user.module';

// Sử dụng ở module khác:
import { UserService, CreateUserDto } from '../user';
*/

// ═══════════════════════════════════════════
// Rule 1.4: SharedModule cho Common Providers
// ═══════════════════════════════════════════

// ❌ BAD: Mỗi module tự tạo instance riêng
/*
// user.module.ts
@Module({ providers: [LoggerService, CacheService, EmailService] })

// order.module.ts
@Module({ providers: [LoggerService, CacheService, EmailService] }) // Trùng lặp!
*/

// ✅ GOOD: SharedModule export common providers
/*
@Global() // Hoặc import SharedModule ở từng module cần
@Module({
  providers: [
    LoggerService,
    CacheService,
    {
      provide: 'MAILER',
      useClass: EmailService,
    },
  ],
  exports: [LoggerService, CacheService, 'MAILER'],
})
export class SharedModule {}
*/

// ═══════════════════════════════════════════
// Rule 1.5: Dynamic Module (forRoot / forRootAsync)
// ═══════════════════════════════════════════

// ❌ BAD: Hardcode config trong module
/*
@Module({
  providers: [{
    provide: 'REDIS_CLIENT',
    useFactory: () => new Redis({ host: 'localhost', port: 6379 }),
  }],
})
export class CacheModule {}
*/

// ✅ GOOD: Dynamic module với forRoot/forRootAsync
interface CacheModuleOptions {
  host: string;
  port: number;
  ttl?: number;
  password?: string;
}

class CacheModule {
  static forRoot(options: CacheModuleOptions) {
    return {
      module: CacheModule,
      providers: [
        { provide: 'CACHE_OPTIONS', useValue: options },
        // CacheService sẽ inject CACHE_OPTIONS
      ],
      exports: ['CACHE_OPTIONS'],
      global: true,
    };
  }

  static forRootAsync(optionsFactory: {
    useFactory: (...args: unknown[]) => CacheModuleOptions;
    inject?: unknown[];
  }) {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useFactory: optionsFactory.useFactory,
          inject: optionsFactory.inject || [],
        },
      ],
      exports: ['CACHE_OPTIONS'],
      global: true,
    };
  }
}

// Sử dụng:
/*
// app.module.ts
@Module({
  imports: [
    CacheModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
*/

// ═══════════════════════════════════════════
// Rule 1.6: Tránh Circular Dependency
// ═══════════════════════════════════════════

// ❌ BAD: Module A import Module B, Module B import Module A
/*
// user.module.ts
@Module({ imports: [OrderModule] })  // User cần Order

// order.module.ts
@Module({ imports: [UserModule] })   // Order cần User → CIRCULAR!
*/

// ✅ GOOD: Dùng forwardRef hoặc tách common interface
/*
// Cách 1: forwardRef (dùng khi không thể tránh)
@Module({
  imports: [forwardRef(() => OrderModule)],
})
export class UserModule {}

// Cách 2 (Preferred): Tách shared interface vào module chung
// shared/interfaces/user-lookup.interface.ts
export interface IUserLookup {
  findById(id: string): Promise<{ id: string; name: string } | null>;
}

// user.module.ts — export provider với token
// order.module.ts — inject bằng token, không cần import UserModule
*/

export { CacheModule, type CacheModuleOptions };
