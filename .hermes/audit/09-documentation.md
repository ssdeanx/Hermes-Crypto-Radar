## 8. Documentation — 7/10

### Good
- Comprehensive README with badges, feature tables, CLI reference, architecture diagram, quick-start guide
- SPEC.md with full specification
- CHANGELOG.md following Keep a Changelog + SemVer
- `.env.example` documents all env vars
- JSDoc on all exported functions across 15+ source files
- CLI has `--help` on all commands
- `crypto-radar-skill.md` documents Hermes plugin usage
- Published package includes README, LICENSE, SPEC

### Problems
- No developer onboarding guide (CONTRIBUTING.md missing)
- No architecture decision records (ADRs)
- No API documentation beyond JSDoc (no TypeDoc generated in CI)
- `npm run docs` configured but TypeDoc may not produce complete output
- No tutorial for adding new tokens or strategies
- No runbook for operational procedures (restart, data recovery, config migration)
- `typedoc` dep installed but never ran in CI
- No inline comments explaining WHY behind complex logic (e.g., voting weights in regime.ts)

### Grade: 7/10
**Next:** Add CONTRIBUTING.md, generate TypeDoc in CI and publish to GitHub Pages, write ADRs for key decisions, add operator runbook.
