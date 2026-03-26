# 📊 Monitoring & Alerts

Quy chuẩn giám sát hệ thống, thiết lập alerts, và incident response cho NestJS production.

---

## 1. Monitoring Stack

| Layer | Tool | Mục đích |
|-------|------|----------|
| **Metrics** | Prometheus + Grafana | Thu thập và hiển thị metrics |
| **Logs** | ELK Stack / Loki | Centralized logging, search |
| **Tracing** | Jaeger / Zipkin | Distributed tracing |
| **Uptime** | UptimeRobot / Pingdom | External health monitoring |
| **Alerting** | PagerDuty / OpsGenie / Slack | Notifications |

---

## 2. Key Metrics to Monitor

### Application Metrics

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `http_requests_total` | Counter | N/A (trend only) |
| `http_request_duration_seconds` | Histogram | p99 > 2s |
| `http_errors_total` | Counter | > 10/min (5xx) |
| `active_connections` | Gauge | > 80% pool |
| `queue_jobs_waiting` | Gauge | > 1000 |
| `queue_jobs_failed_total` | Counter | > 5/min |
| `cache_hit_ratio` | Gauge | < 70% |

### Infrastructure Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| CPU Usage | > 80% for 5 min |
| Memory Usage | > 85% |
| Disk Usage | > 90% |
| DB Connection Pool | > 80% utilized |
| DB Query Duration | p99 > 5s |
| Redis Memory | > 80% maxmemory |

---

## 3. Prometheus Metrics (NestJS)

```typescript
// metrics.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',         // Prometheus scrape endpoint
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class MetricsModule {}

// Custom metrics
@Injectable()
export class AppMetrics {
  constructor(
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram,

    @InjectMetric('business_order_total')
    private readonly orderCounter: Counter,
  ) {}

  recordRequestDuration(method: string, path: string, status: number, durationMs: number): void {
    this.requestDuration
      .labels(method, path, String(status))
      .observe(durationMs / 1000);
  }

  incrementOrderCount(status: string): void {
    this.orderCounter.labels(status).inc();
  }
}
```

---

## 4. Grafana Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  📊 Application Overview                            │
├──────────────┬──────────────┬──────────────┬────────┤
│  Request/sec │  Error Rate  │  p99 Latency │ Uptime │
│     1.2k     │    0.02%     │    245ms     │ 99.98% │
├──────────────┴──────────────┴──────────────┴────────┤
│  📈 Request Rate (last 24h)                         │
│  [=============== graph ===============]             │
├─────────────────────────┬───────────────────────────┤
│  🔴 Error Rate (5xx)    │  ⏱️ Response Time (p50/p99)│
│  [===== graph =====]    │  [===== graph =====]       │
├─────────────────────────┴───────────────────────────┤
│  💾 Database                                        │
├──────────────┬──────────────┬───────────────────────┤
│ Pool Usage   │ Query p99    │ Active Connections     │
│  [gauge]     │  [gauge]     │  [gauge]               │
├──────────────┴──────────────┴───────────────────────┤
│  📦 Queue                                           │
├──────────────┬──────────────┬───────────────────────┤
│ Waiting Jobs │ Failed/min   │ Processing Time        │
│  [gauge]     │  [counter]   │  [histogram]           │
└──────────────┴──────────────┴───────────────────────┘
```

---

## 5. Alert Rules

### Critical (P1) — Immediate Response

```yaml
# Prometheus alert rules
groups:
  - name: critical
    rules:
      - alert: HighErrorRate
        expr: rate(http_errors_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate: {{ $value | humanize }}/sec"
          
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          
      - alert: DatabaseDown
        expr: pg_up == 0
        for: 30s
        labels:
          severity: critical
```

### Warning (P2) — Investigate Within 1 Hour

```yaml
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency > 2s: {{ $value | humanize }}s"
          
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 512
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage > 512MB: {{ $value | humanize }}MB"
          
      - alert: HighDBPoolUsage
        expr: pg_stat_activity_count / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
```

### Info (P3) — Review Next Business Day

```yaml
      - alert: QueueBacklog
        expr: bull_queue_waiting > 500
        for: 15m
        labels:
          severity: info
        annotations:
          summary: "Queue backlog: {{ $value }} jobs waiting"
          
      - alert: LowCacheHitRate
        expr: cache_hit_total / (cache_hit_total + cache_miss_total) < 0.7
        for: 30m
        labels:
          severity: info
```

---

## 6. Alert Routing

```yaml
# AlertManager config
route:
  receiver: slack-default
  routes:
    - match:
        severity: critical
      receiver: pagerduty-oncall
      repeat_interval: 5m

    - match:
        severity: warning
      receiver: slack-engineering
      repeat_interval: 30m

    - match:
        severity: info
      receiver: slack-monitoring
      repeat_interval: 4h

receivers:
  - name: pagerduty-oncall
    pagerduty_configs:
      - service_key: '<pagerduty-key>'

  - name: slack-engineering
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#engineering-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.summary }}'

  - name: slack-monitoring
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#monitoring'
```

---

## 7. Incident Response Runbook

```markdown
## P1 Incident Response

### Step 1: Acknowledge (< 5 min)
- [ ] Acknowledge alert in PagerDuty
- [ ] Join incident Slack channel
- [ ] Post: "Investigating: [alert name]"

### Step 2: Assess (< 10 min)
- [ ] Check error rate dashboard
- [ ] Check recent deployments
- [ ] Check external service status
- [ ] Determine impact: users affected?

### Step 3: Mitigate (< 30 min)
- [ ] If deployment-related → rollback
- [ ] If external service → enable circuit breaker
- [ ] If DB issue → check connections, slow queries
- [ ] If traffic spike → scale up

### Step 4: Resolve
- [ ] Confirm metrics back to normal
- [ ] Post resolution in Slack
- [ ] Update status page

### Step 5: Post-mortem (within 48h)
- [ ] Timeline of events
- [ ] Root cause analysis
- [ ] Action items to prevent recurrence
- [ ] Share with team
```

---

## 8. Uptime SLA Targets

| Tier | Uptime | Downtime/month | Examples |
|------|--------|----------------|----------|
| Tier 1 | 99.99% | ~4.3 min | Payment, Auth |
| Tier 2 | 99.9% | ~43 min | API, Core features |
| Tier 3 | 99.5% | ~3.6 hours | Reports, Analytics |

---

> 💡 **Rule of thumb**: Alert trên symptoms (error rate, latency), không alert trên causes (CPU, memory) — trừ khi cause đã qua threshold nguy hiểm.
