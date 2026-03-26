# 🚀 CI/CD Pipeline

Quy chuẩn thiết lập CI/CD cho NestJS project với GitHub Actions (áp dụng tương tự cho GitLab CI).

---

## 1. Pipeline Overview

```
Push/PR → Lint → Test → Build → Deploy
           │       │       │        │
         ESLint  Jest   Docker   Staging → Production
        Prettier  E2E   Image
```

---

## 2. GitHub Actions — CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ─── Lint ────────────────────────────────
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check "src/**/*.ts"

  # ─── Unit Tests ──────────────────────────
  test-unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run test -- --coverage --ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  # ─── Integration Tests ──────────────────
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: lint

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci

      - name: Run integration tests
        run: npm run test:e2e -- --ci
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USERNAME: test_user
          DB_PASSWORD: test_pass
          DB_DATABASE: test_db
          REDIS_HOST: localhost
          REDIS_PORT: 6379

  # ─── Build ──────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  # ─── Docker Build ────────────────────────
  docker:
    name: Docker Build & Push
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## 3. CD — Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          # Example: Kubernetes deploy
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace staging

      - name: Run smoke tests
        run: |
          sleep 30
          curl -f https://staging.myapp.com/health/live || exit 1

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production       # Requires manual approval
    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace production

      - name: Verify deployment
        run: |
          sleep 30
          curl -f https://api.myapp.com/health/live || exit 1

      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            { "text": "✅ Deployed to production: ${{ github.sha }}" }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 4. Branch Protection Rules

```yaml
# Branch: main
# Settings:
#   ✅ Require pull request before merging
#   ✅ Require approvals: 1
#   ✅ Require status checks to pass:
#       - lint
#       - test-unit
#       - test-integration
#       - build
#   ✅ Require branches to be up to date
#   ✅ Do not allow bypassing settings
```

---

## 5. Environment Secrets

```
# GitHub → Settings → Secrets → Actions

# Shared
CODECOV_TOKEN=xxx
SLACK_WEBHOOK=https://hooks.slack.com/xxx

# Staging
STAGING_KUBECONFIG=base64-encoded
STAGING_DB_URL=postgres://...

# Production
PROD_KUBECONFIG=base64-encoded
PROD_DB_URL=postgres://...
```

---

## 6. Rollback Strategy

```bash
# Option 1: Revert commit
git revert <commit-sha>
git push origin main
# CI/CD tự deploy version mới (reverted)

# Option 2: Kubectl rollback
kubectl rollout undo deployment/myapp --namespace production

# Option 3: Re-deploy previous tag
kubectl set image deployment/myapp myapp=ghcr.io/org/myapp:<previous-sha>
```

---

> 💡 **Tóm tắt**: PR → Lint → Test → Build → Docker → Deploy Staging → (Manual Approval) → Deploy Production. Mọi thứ tự động trừ deploy production.
