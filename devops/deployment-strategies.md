# 🚀 Deployment Strategies

Các chiến lược triển khai ứng dụng lên production, đảm bảo zero-downtime và dễ rollback.

---

## 1. So sánh các chiến lược

| Strategy | Downtime | Rollback Speed | Risk | Resource Cost |
|----------|----------|----------------|------|---------------|
| **Rolling Update** | No | Medium (1-2 min) | Low | 1x |
| **Blue-Green** | No | Instant (swap) | Low | 2x |
| **Canary** | No | Fast (route change) | Very Low | 1.1x |
| **Recreate** | Yes | Slow (redeploy) | High | 1x |

---

## 2. Rolling Update

Thay thế từng instance một. Kubernetes mặc định dùng strategy này.

```
Instance 1: v1 → v2 ✅
Instance 2: v1 → v2 ✅    (lần lượt)
Instance 3: v1 → v2 ✅
```

```yaml
# Kubernetes Rolling Update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # Max 1 pod thêm (tạm thời 4 pods)
      maxUnavailable: 0     # Không được giảm pod → zero downtime
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:v2
          readinessProbe:            # Chỉ route traffic khi ready
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:             # Restart nếu unhealthy
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
```

**Ưu điểm**: Không tốn thêm resource, đơn giản
**Nhược điểm**: Rollback chậm hơn blue-green, 2 versions chạy song song tạm thời

---

## 3. Blue-Green Deployment

Chạy 2 môi trường song song, swap traffic khi ready.

```
                    ┌─────────────┐
Users ──→ LB ──→   │  Blue (v1)  │  ← Current production
                    └─────────────┘
                    ┌─────────────┐
                    │  Green (v2) │  ← New version (testing)
                    └─────────────┘

# Khi Green đã verify → swap LB
                    ┌─────────────┐
                    │  Blue (v1)  │  ← Standby (rollback target)
                    └─────────────┘
                    ┌─────────────┐
Users ──→ LB ──→   │  Green (v2) │  ← Now production
                    └─────────────┘
```

### Implementation

```bash
# 1. Deploy green (new version)
kubectl apply -f deployment-green.yml

# 2. Verify green
curl -f https://green.internal.myapp.com/health/ready

# 3. Switch traffic (update service selector)
kubectl patch service myapp-service -p \
  '{"spec":{"selector":{"version":"green"}}}'

# 4. Rollback (nếu cần) — switch back to blue
kubectl patch service myapp-service -p \
  '{"spec":{"selector":{"version":"blue"}}}'
```

**Ưu điểm**: Rollback instant (swap lại), test green trước khi go-live
**Nhược điểm**: Tốn 2x resource

---

## 4. Canary Deployment

Gửi một phần nhỏ traffic đến version mới, tăng dần nếu OK.

```
Users ──→ LB ──→  95% ──→ v1 (stable)
              └──→  5% ──→ v2 (canary) ← Monitor errors/latency
```

```
Phase 1:  5% traffic → v2   (monitor 15 min)
Phase 2: 25% traffic → v2   (monitor 30 min)
Phase 3: 50% traffic → v2   (monitor 1 hour)
Phase 4: 100% traffic → v2  (fully rolled out)
```

### Kubernetes + Istio

```yaml
# VirtualService — traffic splitting
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp.example.com
  http:
    - route:
        - destination:
            host: myapp-stable
            port:
              number: 3000
          weight: 95
        - destination:
            host: myapp-canary
            port:
              number: 3000
          weight: 5
```

### Auto-rollback criteria

```yaml
# Flagger — auto canary with rollback
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: myapp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  analysis:
    interval: 1m
    threshold: 5           # Max 5 failed checks before rollback
    maxWeight: 50          # Max canary traffic %
    stepWeight: 10         # Increase 10% per step
    metrics:
      - name: request-success-rate
        threshold: 99       # Rollback nếu success < 99%
      - name: request-duration
        threshold: 500      # Rollback nếu p99 > 500ms
```

**Ưu điểm**: Risk thấp nhất, rollback tự động
**Nhược điểm**: phức tạp hơn, cần monitoring tốt

---

## 5. Feature Flags

Tách deployment khỏi release — deploy code nhưng chưa bật feature.

```typescript
// Feature flag service
interface FeatureFlags {
  newCheckoutFlow: boolean;
  darkMode: boolean;
  betaSearch: boolean;
}

// Usage in code
if (featureFlags.isEnabled('newCheckoutFlow', { userId })) {
  return this.newCheckoutService.process(order);
} else {
  return this.legacyCheckoutService.process(order);
}
```

**Lợi ích**:
- Deploy bất kỳ lúc nào, bật feature khi sẵn sàng
- A/B testing dễ dàng
- Kill switch — tắt feature ngay nếu có bug

---

## 6. Database Migration Strategy khi Deploy

```
1. Deploy code backward-compatible (đọc cả column cũ + mới)
2. Run migration (thêm column mới, KHÔNG xóa column cũ)
3. Verify — data đúng
4. Deploy code chỉ dùng column mới
5. Run cleanup migration (xóa column cũ) — sau 1-2 tuần
```

**Rule**: Migration phải backward-compatible. Không bao giờ xóa column/table trong cùng release với code change.

---

## 7. Rollback Checklist

```markdown
## Khi cần rollback:

1. [ ] Xác nhận issue (error spike, latency tăng, user reports)
2. [ ] Thông báo team: "Rolling back production to v1.2.3"
3. [ ] Thực hiện rollback:
   - K8s: `kubectl rollout undo deployment/myapp`
   - Blue-Green: swap LB back
   - Canary: set canary weight = 0
4. [ ] Verify rollback thành công (health check, error rate)
5. [ ] Thông báo team: "Rollback complete"
6. [ ] Post-mortem: root cause analysis
7. [ ] Fix và re-deploy
```

---

> 💡 **Recommendation**: Dùng **Rolling Update** cho hầu hết cases. Chuyển sang **Canary** khi hệ thống critical và cần monitor chi tiết. **Blue-Green** cho khi cần instant rollback.
