## 3. Configuration & UX — 8/10

### Good
- Dual config system: `radar.config.json` + environment variables with `RADAR__` prefix
- Config auto-discovery from project root
- `.env.example` documents all 9 env vars with defaults
- Config override via env vars for both strategy and timeframe weights
- Sensible defaults throughout
- CLI has rich command set with `commander` — scan, signals, news, chart, daemon, export, backtest, benchmark
- JSON, MD, HTML, CSV, XLSX output formats
- `--filter`, `--period`, `--dynamic`, `--onchain` flags for scan
- Auto-discovery of config, graceful fallbacks

### Problems
- `crypto-radar.json` and `radar.config.json` — TWO config files with different schemas, confusion risk
- Config schema not validated at startup (malformed JSON silently uses defaults)
- No config migration path for backward-incompatible changes
- Daemon uses `LOCK_FILE` and `STATE_FILE` constants that reference hardcoded paths
- No config watch/reload — requires restart for changes
- CLI `--help` output could be richer (no examples, no `--help` per-subcommand in all cases)

### Grade: 8/10
**Next:** Merge to single config file, add JSON Schema validation, add `config validate` and `config watch` commands.
