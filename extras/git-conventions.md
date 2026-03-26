# 📋 Git Conventions

Quy chuẩn sử dụng Git cho team, đảm bảo history rõ ràng, dễ review, và dễ rollback.

---

## 1. Conventional Commits

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Mô tả | Ví dụ |
|------|--------|-------|
| `feat` | Tính năng mới | `feat(auth): add refresh token rotation` |
| `fix` | Sửa bug | `fix(orders): correct total calculation with discount` |
| `refactor` | Refactor code (không thay đổi behavior) | `refactor(users): extract validation to separate service` |
| `perf` | Cải thiện performance | `perf(products): add Redis cache for product listing` |
| `test` | Thêm/sửa test | `test(auth): add unit tests for login rate limiting` |
| `docs` | Cập nhật documentation | `docs(api): update Swagger descriptions for orders` |
| `chore` | Task không liên quan code | `chore(deps): upgrade NestJS to v10.3` |
| `ci` | CI/CD changes | `ci: add staging deployment workflow` |
| `style` | Formatting (không ảnh hưởng logic) | `style: fix ESLint warnings in user module` |
| `build` | Build system changes | `build: update Dockerfile for multi-stage` |
| `revert` | Revert commit trước | `revert: revert "feat(auth): add OAuth2"` |

### ❌ BAD Commit Messages

```
fix bug
update code
WIP
asdf
changes
fix stuff
```

### ✅ GOOD Commit Messages

```
feat(orders): implement order cancellation with refund

- Add cancelOrder endpoint (POST /orders/:id/cancel)
- Process refund through payment gateway
- Send cancellation email to customer
- Update inventory (return reserved stock)

Closes #234
```

```
fix(auth): prevent timing attack on login endpoint

Previously, the login endpoint returned different response times
for existing vs non-existing users, allowing email enumeration.

Now both paths always perform bcrypt comparison to normalize
response time.

Security: CVE-2024-XXXX
```

### Scope Convention

```
feat(auth):        → Authentication module
feat(users):       → User management
feat(orders):      → Order processing
feat(products):    → Product catalog
feat(payments):    → Payment processing
feat(api):         → API layer (controllers, DTOs)
feat(db):          → Database (migrations, queries)
feat(config):      → Configuration
feat(common):      → Shared/common module
```

---

## 2. Branch Naming

### Format

```
<type>/<ticket-id>-<short-description>
```

### ❌ BAD

```
my-branch
fix
john-feature
test123
new-stuff
```

### ✅ GOOD

```
feature/PROJ-123-add-order-cancellation
fix/PROJ-456-login-rate-limit-bypass
refactor/PROJ-789-extract-payment-service
hotfix/PROJ-101-fix-production-crash
chore/PROJ-202-upgrade-nestjs-v10
release/v1.2.0
```

### Branch Types

| Prefix | Mô tả |
|--------|--------|
| `feature/` | Tính năng mới |
| `fix/` | Bug fix |
| `hotfix/` | Fix critical bug trên production |
| `refactor/` | Code refactoring |
| `chore/` | Maintenance tasks |
| `release/` | Release preparation |
| `docs/` | Documentation only |

---

## 3. Branch Strategy (Git Flow Simplified)

```
main ──────────────────────────────────────────→ Production
  │
  ├── develop ─────────────────────────────────→ Integration
  │     │
  │     ├── feature/PROJ-123-add-cart ─────→ PR → develop
  │     ├── feature/PROJ-456-payment ──────→ PR → develop
  │     └── fix/PROJ-789-login-bug ────────→ PR → develop
  │
  └── hotfix/PROJ-101-critical-fix ────────→ PR → main + develop
```

### Rules

1. **main** — luôn deployable, chỉ merge từ `develop` hoặc `hotfix`
2. **develop** — integration branch, merge features vào đây
3. **feature/** — branch từ `develop`, PR back vào `develop`
4. **hotfix/** — branch từ `main`, PR vào cả `main` + `develop`
5. **Không push trực tiếp vào `main` hoặc `develop`**

---

## 4. Pull Request (PR) Convention

### PR Title

Giống commit message format:

```
feat(orders): implement order cancellation with refund (#234)
```

### PR Template

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] 🆕 New feature
- [ ] 🐛 Bug fix
- [ ] ♻️ Refactoring
- [ ] 📝 Documentation
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test

## Changes Made
- Added `cancelOrder` method in `OrderService`
- Created `POST /orders/:id/cancel` endpoint
- Added refund processing via PaymentGateway
- Updated order status enum with `CANCELLED`

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing done

## Screenshots (if UI changes)
N/A

## Checklist
- [ ] Code follows project conventions
- [ ] Self-reviewed the code
- [ ] No console.log or debug code
- [ ] Database migration included (if schema change)
- [ ] Environment variables documented
```

### PR Rules

1. **Max 400 lines changed** — quá lớn thì tách PR
2. **1 PR = 1 feature/fix** — không trộn multiple concerns
3. **Require 1+ approval** trước khi merge
4. **CI phải pass** — tests, lint, build
5. **Squash merge** vào develop → clean history

---

## 5. Merge Strategy

### Squash Merge (Recommended cho feature branches)

```bash
# Gộp tất cả commits thành 1 commit clean
git merge --squash feature/PROJ-123-add-cart
```

**Ưu điểm**: History sạch, mỗi feature = 1 commit
**Dùng cho**: feature → develop

### Merge Commit (cho release/hotfix)

```bash
# Giữ nguyên history
git merge --no-ff release/v1.2.0
```

**Dùng cho**: develop → main, hotfix → main

### Rebase (cho update feature branch)

```bash
# Cập nhật feature branch với develop mới nhất
git checkout feature/my-feature
git rebase develop
```

**⚠️ KHÔNG rebase branches đã push và shared**

---

## 6. Tag Convention

```bash
# Semantic versioning
git tag -a v1.2.0 -m "Release v1.2.0: Order cancellation, payment refund"
git tag -a v1.2.1 -m "Hotfix v1.2.1: Fix login rate limit bypass"

# Format: v<MAJOR>.<MINOR>.<PATCH>
# MAJOR: Breaking changes
# MINOR: New features (backward compatible)
# PATCH: Bug fixes
```

---

## 7. .gitignore Essentials

```gitignore
# Dependencies
node_modules/
package-lock.json  # Optional: some teams commit this

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/settings.json
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/

# Docker
docker-compose.override.yml
```

---

## 8. Git Hooks (Husky + lint-staged)

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  },
  "commitlint": {
    "extends": ["@commitlint/config-conventional"]
  }
}
```

---

> 💡 **Tóm tắt**: Conventional commits + clear branch naming + PR template + squash merge = clean, traceable Git history.
