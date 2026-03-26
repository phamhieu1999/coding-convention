# 🐳 Docker Conventions

Quy chuẩn viết Dockerfile và docker-compose cho NestJS projects, tối ưu build time, image size, và security.

---

## 1. Dockerfile — Multi-Stage Build

### ❌ BAD: Single-stage, install devDependencies trong production image

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install          # Cả devDependencies!
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
# Image size: ~1.5GB, chứa source code + devDeps
```

### ✅ GOOD: Multi-stage build — tách build và runtime

```dockerfile
# ─── Stage 1: Build ────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Build
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# ─── Stage 2: Production ───────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Non-root user
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Graceful shutdown
CMD ["node", "dist/main.js"]
# Image size: ~200MB (vs 1.5GB)
```

---

## 2. .dockerignore

```dockerignore
# Dependencies
node_modules/
npm-debug.log

# Build output
dist/
build/

# Source control
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp

# Environment
.env
.env.*
!.env.example

# Documentation
*.md
LICENSE

# Tests
test/
coverage/
jest.config.*
.jest/

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# CI
.github/
.gitlab-ci.yml
```

---

## 3. Docker Layer Caching Strategy

```dockerfile
# ✅ GOOD: Dependencies layer cached (change ít nhất)
COPY package.json package-lock.json ./    # Layer 1: deps definition
RUN npm ci                                 # Layer 2: deps install (cached nếu lock không đổi)
COPY src/ ./src/                           # Layer 3: source code (thay đổi thường xuyên)
RUN npm run build                          # Layer 4: build

# ❌ BAD: COPY . . trước install → mỗi code change invalidate deps cache
# COPY . .
# RUN npm install
```

**Thứ tự ưu tiên layers** (ít thay đổi → nhiều thay đổi):
1. Base image + system deps
2. `package.json` + `package-lock.json`
3. `npm ci` (cached nếu lock file không đổi)
4. Source code `COPY`
5. Build command

---

## 4. docker-compose — Development

```yaml
# docker-compose.yml — Development
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder       # Dùng build stage cho dev
    ports:
      - "3000:3000"
      - "9229:9229"         # Debug port
    volumes:
      - ./src:/app/src      # Hot reload
      - ./test:/app/test
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - DB_DATABASE=myapp_dev
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run start:dev

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## 5. docker-compose — Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## 6. Security Best Practices

```dockerfile
# ✅ Pin version — tránh unexpected breaking changes
FROM node:20.11.1-alpine3.19

# ✅ Non-root user
USER appuser

# ✅ Read-only filesystem (nếu có thể)
# docker run --read-only --tmpfs /tmp myapp

# ✅ Scan vulnerabilities
# docker scout cves myapp:latest
# trivy image myapp:latest

# ✅ Không COPY secrets vào image
# Dùng runtime env vars hoặc Docker secrets
```

---

## 7. Useful Commands

```bash
# Build
docker build -t myapp:latest .
docker build --target builder -t myapp:dev .

# Run
docker-compose up -d
docker-compose -f docker-compose.prod.yml up -d

# Logs
docker-compose logs -f app
docker-compose logs --tail=100 app

# Shell access
docker-compose exec app sh

# Cleanup
docker system prune -af --volumes    # ⚠️ Xóa tất cả unused
docker image prune -f                 # Xóa dangling images
docker volume prune -f                # Xóa unused volumes

# Image size check
docker images myapp --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

---

> 💡 **Tóm tắt**: Multi-stage build + .dockerignore + layer caching + non-root user + health check = Dockerfile production-ready.
