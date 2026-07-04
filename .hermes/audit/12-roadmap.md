# 🗺️ Enterprise Readiness Roadmap

## Phase 0 — Quick Wins (Week 1)
| # | Task | Impact | Effort |
|---|------|--------|--------|
| 0.1 | Remove all 186 unused imports/vars lint warnings | Low code debt | 30 min |
| 0.2 | Fix the 1 lint error | Clean CI output | 5 min |
| 0.3 | Enable `noUnusedLocals: true` in tsconfig | Prevent regressions | 1 min |
| 0.4 | Replace `(config as any).webhooks` with typed access | Type safety | 5 min |
| 0.5 | Replace `console.*` calls with structured logger | Consistent logging | 10 min |
| 0.6 | Sync plugin.yaml version to 1.4.0 | Consistency | 1 min |
| 0.7 | Make coverage gate HARD FAIL in CI | Enforce quality | 5 min |

## Phase 1 — Testing Foundation (Week 2-3)
| # | Task | Target Coverage |
|---|------|-----------------|
| 1.1 | Add unit tests for `alerts.ts` | 100% |
| 1.2 | Add unit tests for `webhook.ts` (mocked HTTP) | 100% |
| 1.3 | Add CLI integration tests for `cli.ts` (temp files) | 70% |
| 1.4 | Add unit tests for `ws.ts` (mock WS server) | 80% |
| 1.5 | Add unit tests for `backtest.ts` | 80% |
| 1.6 | Test `onchain.ts` with mock HTTP | 80% |
| 1.7 | Test `regime.ts` | 100% |
| 1.8 | Enable E2E smoke tests in CI nightly | Integration safety |

**Goal after Phase 1:** Overall coverage ≥ 65%

## Phase 2 — Enterprise Hardening (Week 3-4)
| # | Task |
|---|------|
| 2.1 | Add JSON Schema validation for config files |
| 2.2 | Implement config watch/reload without restart |
| 2.3 | Add OpenTelemetry metrics export |
| 2.4 | Add correlation IDs through scan pipeline |
| 2.5 | Implement retry with exponential backoff for API calls |
| 2.6 | Add health check alerting (webhook on degraded) |
| 2.7 | Secure WebSocket server with rate limiting |
| 2.8 | Add typed error responses for Hermes tools |

## Phase 3 — Production Live (Week 5-6)
| # | Task |
|---|------|
| 3.1 | Refactor `radar.ts` — split into scan orchestrator, enrichment service, output dispatcher |
| 3.2 | Refactor `cli.ts` — extract business logic from commands |
| 3.3 | Add Dockerfile + docker-compose for containerized deployment |
| 3.4 | Implement event bus for inter-module communication |
| 3.5 | Add SQLite-backed signal performance tracking (live win rate) |
| 3.6 | Add `standard-version` or `semantic-release` for automated versioning |
| 3.7 | Add ADR docs for architecture decisions |
| 3.8 | Publish TypeDoc to GitHub Pages via CI |

## Phase 4 — Differentiation (Week 7-8)
| # | Task |
|---|------|
| 4.1 | Add ML-based regime prediction (train on historical backtest data) |
| 4.2 | Add risk management module (position sizing, portfolio heat) |
| 4.3 | Add multi-user support with Hermes identity integration |
| 4.4 | Add pluggable data source framework (CoinGecko, Kraken, etc.) |
| 4.5 | Add automated strategy optimization via grid search in CI |
| 4.6 | Add Telegram/Discord interactive bot (not just push alerts) |

## Critical Path Items (Must-Have Before "Live")
```
1. COVERAGE → Phase 1 (all 8 tasks)  → Unblocks enterprise trust
2. ERROR HANDLING → 2.3, 2.5, 2.8  → Unblocks production reliability
3. SECURITY → 2.1, 2.7              → Unblocks external data handling
4. CI GATING → 0.7, 1.8             → Unblocks safe deployments
```

**Current blocker:** Coverage at 38% with 17 zero-coverage modules. Fixing that alone would take the project from 4.5/10 to ~6/10 instantly.
