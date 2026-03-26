# 🛠️ Environment Setup Guide

Hướng dẫn cài đặt môi trường phát triển cho NestJS project, đảm bảo mọi developer có cùng setup.

---

## 1. Required Tools

| Tool | Version | Mục đích |
|------|---------|----------|
| Node.js | >= 20 LTS | Runtime |
| npm | >= 10 | Package manager |
| Docker | >= 24 | Database, Redis, services |
| Docker Compose | >= 2.20 | Multi-container orchestration |
| Git | >= 2.40 | Version control |
| VS Code | Latest | IDE (recommended) |

### Cài đặt nhanh

```bash
# Node.js (via nvm — recommended)
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v    # v20.x.x
npm -v     # 10.x.x

# Docker (xem https://docs.docker.com/get-docker/)
docker --version
docker compose version
```

---

## 2. Project Setup

```bash
# Clone repo
git clone <repo-url>
cd <project-name>

# Install dependencies
npm ci    # ci = clean install (dùng package-lock.json exact versions)

# Copy environment file
cp .env.example .env

# Start infrastructure (DB, Redis)
docker compose up -d postgres redis

# Run migrations
npm run migration:run

# Seed data (optional)
npm run seed

# Start dev server
npm run start:dev
```

---

## 3. .env.example Template

```env
# ─── App ───────────────────────────────────
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_VERSION=v1

# ─── Database ──────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=myapp_dev
DB_SSL=false
DB_POOL_MAX=10
DB_LOGGING=true

# ─── Redis ─────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=myapp:

# ─── JWT ───────────────────────────────────
JWT_ACCESS_SECRET=dev-access-secret-change-in-production-min-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── Email (optional in dev) ──────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=

# ─── External Services ────────────────────
# PAYMENT_API_URL=https://sandbox.payment.com
# PAYMENT_API_KEY=sk_test_xxx

# ─── Logging ──────────────────────────────
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

---

## 4. VS Code Extensions (Recommended)

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-azuretools.vscode-docker",
    "prisma.prisma",
    "humao.rest-client",
    "mikestead.dotenv",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

---

## 5. VS Code Settings

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 6. NPM Scripts Convention

```json
{
  "scripts": {
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main.js",

    "build": "nest build",
    "build:watch": "nest build --watch",

    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",

    "migration:generate": "typeorm migration:generate -d src/data-source.ts",
    "migration:run": "typeorm migration:run -d src/data-source.ts",
    "migration:revert": "typeorm migration:revert -d src/data-source.ts",
    "migration:show": "typeorm migration:show -d src/data-source.ts",

    "seed": "ts-node src/database/seeds/run-seed.ts",

    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f"
  }
}
```

---

## 7. Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| `npm ci` fails | Xóa `node_modules` và `package-lock.json`, chạy `npm install` |
| DB connection refused | Chạy `docker compose up -d postgres`, kiểm tra `.env` |
| Port 3000 already in use | `lsof -i :3000` → kill process, hoặc đổi `PORT` trong `.env` |
| Migration fails | Kiểm tra DB connection, chạy `npm run migration:show` |
| Redis connection refused | Chạy `docker compose up -d redis` |
| TypeScript compilation errors | `npm run build` để xem lỗi, kiểm tra `tsconfig.json` |
| Hot reload not working | Kiểm tra `nest start --watch`, restart dev server |

---

> 💡 **Tip**: Mọi developer mới chỉ cần: `git clone` → `npm ci` → `cp .env.example .env` → `docker compose up -d` → `npm run start:dev`. Xong trong 5 phút.
