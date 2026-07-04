## 1. Architecture & Design — 7/10

### Structure
Clear hexagonal-ish architecture: `src/` (core logic), `src/core/` (infra), `src/analysis/` (strategy engine), `src/io/` (output), `src/monitor/` (health). Barrel exports, clean module boundaries.

### Grade: 7/10
**Good:**
- Clean separation of concerns (config, cache, errors, rate-limiter, circuit-breaker as core services)
- Strategy pattern with `SignalStrategy` interface allows pluggable trading strategies
- Multi-timeframe aggregation with weighted voting
- Market regime detection influencing strategy weights (adaptive)
- Backtesting engine with proper metrics (Sharpe, win rate, max DD)
- Warm daemon for sub-50ms tool calls
- Circuit breaker for external API resilience

**Missing for 9-10:**
- No event bus / pub-sub for inter-module communication (tight coupling via direct imports)
- No state machine for scan pipeline lifecycle
- No Dependency Injection container — modules import each other directly (hard to test in isolation)
- No plugin architecture for external data sources (hardcoded Binance/DeFiLlama/Jupiter)
- No graceful degradation matrix documented
- `radar.ts` is 393 lines and does too much (scan orchestration, enrichment, export — single responsibility violation)
- `cli.ts` at 724 lines violates SRP severely — mixes command parsing, business logic, and I/O

```
radar.ts (393 lines) — scan orchestration, data enrichment, output dispatch → SRP violation
cli.ts (724 lines) — CLI parsing, daemon control, formatting, export → massive SRP violation
```
