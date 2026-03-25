/**
 * ============================================
 * NESTJS CONVENTION #7: CONFIG MANAGEMENT
 * ============================================
 *
 * Nguyên tắc:
 * 1. KHÔNG hardcode config — luôn dùng environment variables
 * 2. Validate env khi app start (fail fast)
 * 3. Typed config với @nestjs/config
 * 4. Tách config theo domain (database, redis, jwt, ...)
 * 5. Default values cho development, required cho production
 * 6. Secrets KHÔNG bao giờ commit vào source code
 */

declare const process: { env: Record<string, string | undefined> };

// ═══════════════════════════════════════════
// Rule 7.1: Không Hardcode Config
// ═══════════════════════════════════════════

// ❌ BAD: Hardcode config values
/*
@Injectable()
export class AuthService {
  async generateToken(userId: string): Promise<string> {
    return jwt.sign({ sub: userId }, 'my-super-secret-key', { // Secret in code!
      expiresIn: '24h',
    });
  }
}

@Injectable()
export class DatabaseService {
  constructor() {
    this.client = new Client({
      host: 'localhost',        // Hardcoded!
      port: 5432,
      username: 'admin',
      password: 'admin123',     // Password in code!
      database: 'myapp',
    });
  }
}
*/

// ✅ GOOD: Config từ environment
/*
@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  async generateToken(userId: string): Promise<string> {
    return jwt.sign(
      { sub: userId },
      this.configService.getOrThrow<string>('JWT_SECRET'),
      { expiresIn: this.configService.get('JWT_EXPIRES_IN', '24h') },
    );
  }
}
*/

// ═══════════════════════════════════════════
// Rule 7.2: Env Validation — Fail Fast
// ═══════════════════════════════════════════

// ❌ BAD: Không validate, lỗi runtime mới phát hiện
/*
// App start thành công, nhưng crash khi gọi DB connection
// vì DB_HOST chưa set → mất 30 phút debug
const dbHost = process.env.DB_HOST; // undefined!
*/

// ✅ GOOD: Validate bằng Joi khi app start
/*
// config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  PORT: Joi.number().default(3000),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // External Services
  SMTP_HOST: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
  ],
})
export class AppModule {}
// → App crash TẠI STARTUP nếu thiếu env → dễ phát hiện
*/

// ═══════════════════════════════════════════
// Rule 7.3: Typed Config — Tách theo Domain
// ═══════════════════════════════════════════

// ❌ BAD: Gọi configService.get('KEY') rải rác, typo dễ xảy ra
/*
// Trong file A
this.configService.get('DB_HOST');

// Trong file B — typo!
this.configService.get('DB_HOSG'); // undefined, không ai biết
*/

// ✅ GOOD: Typed config namespace
// config/database.config.ts
const createDatabaseConfig = () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'myapp',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
});

// config/redis.config.ts
const createRedisConfig = () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: process.env.REDIS_PREFIX || 'app:',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },
});

// config/jwt.config.ts
const createJwtConfig = () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'myapp',
  },
});

/*
// app.module.ts — Load tất cả config
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [createDatabaseConfig, createRedisConfig, createJwtConfig],
    }),
  ],
})

// Sử dụng — type-safe:
@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {}

  getJwtSecret(): string {
    return this.configService.getOrThrow<string>('jwt.secret');
  }

  getJwtExpiration(): string {
    return this.configService.get<string>('jwt.accessExpiresIn', '15m');
  }
}
*/

// ═══════════════════════════════════════════
// Rule 7.4: Config Interface cho Type Safety
// ═══════════════════════════════════════════

// ✅ GOOD: Interface cho mỗi config namespace
interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  poolSize: number;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  keyPrefix: string;
  ttl: number;
}

interface JwtConfig {
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
}

interface AppConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
}

// ═══════════════════════════════════════════
// Rule 7.5: .env File Convention
// ═══════════════════════════════════════════

// ✅ GOOD: .env.example (COMMIT vào repo)
/*
# ─── App ───────────────────────────────
NODE_ENV=development
PORT=3000

# ─── Database ──────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=change_me
DB_DATABASE=myapp_dev
DB_SSL=false
DB_POOL_SIZE=10

# ─── Redis ─────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=myapp:

# ─── JWT ───────────────────────────────
JWT_SECRET=replace-with-at-least-32-char-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── External APIs ────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
*/

// .gitignore — LUÔN ignore .env files
/*
.env
.env.local
.env.production
.env.staging
!.env.example    ← Chỉ commit file example
*/

// ═══════════════════════════════════════════
// Rule 7.6: Config cho Different Environments
// ═══════════════════════════════════════════

// ✅ GOOD: Load config theo NODE_ENV
/*
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    `.env.${process.env.NODE_ENV}.local`, // Highest priority
    `.env.${process.env.NODE_ENV}`,
    '.env.local',
    '.env',                                // Lowest priority
  ],
});
*/

// ─────────────────────────────────────────────
// File structure:
// .env              → defaults cho development
// .env.staging      → overrides cho staging
// .env.production   → production config (managed by DevOps)
// .env.local        → local overrides (gitignored)
// .env.example      → template (committed)
// ─────────────────────────────────────────────

export {
  createDatabaseConfig,
  createRedisConfig,
  createJwtConfig,
  type AppConfig,
  type DatabaseConfig,
  type RedisConfig,
  type JwtConfig,
};
