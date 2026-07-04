## 6. Observability & Monitoring — 7/10

### Good
- Structured logger (`pino`-style via `core/logger.ts`) with child loggers per module
- Health monitor with check functions for Binance, Jupiter, DeFiLlama, data files, system resources, cache, feed health
- Cache hit-rate tracking (`Cache.getAllHealthStats()`)
- Feed health monitor with degraded/dead detection
- Circuit breaker exposes state transitions
- Log rotation at 10MB, gzipped, 5 archive retention
- `uptime` tracking in health checks
- Benchmark command for performance measurement

### Problems
- No metrics export endpoint (Prometheus/OpenTelemetry)
- No structured logging format standard (some `.info()`, some `.warn()`, some `console.*`)
- No log correlation IDs — impossible to trace a single scan across modules
- Health monitor runs only on demand (`crypto-radar daemon --status`) — not a background service
- No alerting when health checks fail (no webhook on degraded/unhealthy)
- No metrics on signal performance (win rate tracking over time is offline via backtest only)
- Cache stats are in-memory only, lost on restart
- No performance budget enforcement

### Grade: 7/10
**Next:** Export Prometheus metrics endpoint, add correlation IDs, implement continuous health monitoring with alerting, track signal performance over time in SQLite.
