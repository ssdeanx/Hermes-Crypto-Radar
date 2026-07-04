## 2. Code Quality & Type Safety — 6/10

### Good
- Full TypeScript 6.0 with strict mode (presumably), strong typing throughout
- Comprehensive type definitions in `types.ts`
- Well-documented JSDoc on all exported functions
- Consistent code style enforced by Prettier + ESLint
- ESM modules (`"type": "module"`)
- No `any` usage in most modules (except webhook.ts which uses `(config as any).webhooks`)
- Null-safe with `??` and optional chaining

### Problems
- **1 lint error, 186 warnings** — mostly unused imports/vars, some `no-console` violations
- Unused types: `CoinGeckoPrice`, `TokenSignal`, `Chain`, `ProtocolMetrics` imported but never used
- Unused functions: `toSignalReport`, `getTokenById`
- Dead code: `LOCK_FILE`, `STATE_FILE`, `XLSX_DATE_FMT`, `isPresent` — assigned but never used
- `webhook.ts` uses `(config as any).webhooks` — lost type safety
- `alerts.ts` also uses `(config as unknown as { alerts?: ... }).alerts` — unsafe cast
- Several test files import unused types
- No strict null checks evidence (some code branches return `?? null` redundantly)
- `console.error()` in `log-rotation.ts` instead of logger — bypasses structured logging

### Grade: 6/10
**Next:** Fix all lint warnings (mostly remove dead code), eliminate `any` casts, enforce `noUnusedLocals: true` in tsconfig.
