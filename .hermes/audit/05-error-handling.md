## 4. Error Handling — 5/10

### Good
- Custom error classes (`errors.ts`) for structured error taxonomy: `ConfigError`, `ApiError`, `DataError`, `TimeoutError`, `CircuitBreakerOpenError`, `PluginToolError`
- Circuit breaker pattern prevents cascading failures
- `error-context.ts` and `recovery.ts` (from plugin task)
- Feed monitor with degraded/dead detection
- `AbortSignal.timeout()` on all external HTTP calls
- `Promise.allSettled()` for parallel external fetches — non-fatal errors don't kill the whole scan

### Problems
- `radar.ts` has a `try/catch (err: any)` that logs but doesn't distinguish error types — `catch (err: any)` throughout
- No structured error response for Hermes tool interface — errors bubble as raw exceptions
- No retry logic on transient API failures at the module level (only circuit breaker, which is binary)
- Webhook failures silently swallowed (`.warn()`, not `.error()`)
- `config.ts` returns default config on parse failure — silent degradation
- No alerting on error rate thresholds
- No correlation IDs through the scan pipeline — can't trace a failed scan across logs
- Error messages inconsistent between modules (`logger.error()` vs `console.error()`)

### Grade: 5/10
**Next:** Replace `catch (err: any)` with typed error handling per module, add correlation IDs, implement retry with exponential backoff, alert on error rate spikes.
