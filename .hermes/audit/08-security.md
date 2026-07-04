## 7. Security — 5/10

### Good
- No API keys or secrets committed to source code
- `.npmignore` excludes sensitive files
- `.env.example` documents required vars without hardcoded secrets
- All external API calls use HTTPS
- Circuit breaker prevents API abuse during outages
- Rate limiter for API call throttling

### Problems
- **No input validation** on CLI arguments or config file values — malformed input could crash
- **No output sanitization** — alert messages formatted with user-provided config values could inject into Discord/Telegram
- Config is loaded with `JSON.parse()` on user file — no schema validation
- Webhook URLs/tokens loaded from config with no validation — a malformed URL would silently fail
- `npm audit` / `npm run audit` not in CI — dependency vulnerabilities unmonitored
- No dependency pinning — `^` ranges in package.json, supply chain risk
- No code signing or integrity verification for published package
- Data directory has no permission checks — assumes `~/.hermes/data/` exists and is writable
- No rate limiting on the WebSocket server
- No authentication for the daemon's internal IPC

### Grade: 5/10
**Next:** Add config JSON Schema validation, input sanitization for webhook messages, npm audit in CI, pin dependencies with lockfile, add dependency diff scanning.
