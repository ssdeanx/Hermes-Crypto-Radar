## 5. Testing & Coverage — 3/10

### Coverage by Module

| Module | Stmts | Branch | Func | Lines | Verdict |
|--------|-------|--------|------|-------|---------|
| Overall | 37.9% | 36.5% | 42.6% | 38.6% | ❌ FAIL |
| indicators.ts | 99% | 97% | 100% | 100% | ✅ |
| circuit-breaker.ts | 100% | 100% | 100% | 100% | ✅ |
| rate-limiter.ts | 100% | 100% | 100% | 100% | ✅ |
| signals.ts | 90% | 80% | 100% | 96% | ✅ |
| xlsx-export.ts | 96% | 75% | 100% | 96% | ✅ |
| trend-following.ts | 90% | 83% | 100% | 91% | ✅ |
| momentum.ts | 83% | 81% | 100% | 83% | ✅ |
| config.ts | 86% | 80% | 100% | 88% | ✅ |
| radar.ts | 83% | 62% | 85% | 86% | ⚠️ |
| cache.ts | 84% | 76% | 83% | 87% | ✅ |
| engine.ts | 82% | 70% | 88% | 83% | ⚠️ |
| mean-reversion.ts | 64% | 68% | 100% | 64% | ⚠️ |
| tokens.ts | 67% | 82% | 69% | 66% | ⚠️ |
| binance.ts | 73% | 69% | 60% | 72% | ⚠️ |
| health.ts | 73% | 47% | 54% | 75% | ⚠️ |
| **cli.ts** | **0%** | **0%** | **0%** | **0%** | ❌ CRITICAL |
| **backtest.ts** | **0%** | **0%** | **0%** | **0%** | ❌ CRITICAL |
| **ws.ts** | **0%** | **0%** | **0%** | **0%** | ❌ CRITICAL |
| **webhook.ts** | **0%** | **0%** | **0%** | **0%** | ❌ CRITICAL |
| **alerts.ts** | **0%** | **0%** | **0%** | **0%** | ❌ CRITICAL |
| **correlation.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **patterns.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **support-resistance.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **volume-profile.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **regime.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **onchain.ts** | **6%** | **0%** | **0%** | **7%** | ❌ |
| **io/advanced-charts.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **io/signal-dashboard.ts** | **0%** | **0%** | **0%** | **0%** | ❌ |
| **io/charts.ts** | 53% | 37% | 77% | 54% | ⚠️ |
| **log-rotation.ts** | 41% | 33% | 50% | 38% | ❌ |

### Problems
- 17 source modules have ZERO test coverage
- Coverage gate thresholds (80/70/75/80) in vitest config don't block CI — they're warnings, not errors
- CLI is untested — all business logic via commander is manually tested only
- WebSocket server (ws.ts) completely untested — real-time streaming is a critical feature
- Webhook notifications (Discord/Telegram) untested — would break silently in production
- Backtest engine at 0% coverage despite being a key value proposition
- E2E tests exist but are `describe.skip` — never run in CI
- No property-based or fuzz testing despite having `fuzz.test.ts` (coverage data suggests it runs)

### Grade: 3/10
**Next:** Add tests for cli.ts (integration tests with temp files), webhook.ts (mocked HTTP), ws.ts (mock WS server), alerts.ts, backtest.ts. Enable E2E tests in CI as scheduled smoke tests. Make coverage gate HARD FAIL.
