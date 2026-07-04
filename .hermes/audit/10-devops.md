## 9. DevOps & CI/CD — 6/10

### Good
- GitHub Actions CI: builds on Node 20 + 22, runs tests + lint, checks dist output
- Separate Release, Publish to Marketplace, and Nightly E2E workflows
- Coverage report uploaded as CI artifact
- Husky pre-commit hook runs tests
- `prepare` script auto-installs husky on `npm install`
- `npm run build` includes `tsc` with no errors
- `.npmignore` for clean publishing
- Tarball packaging for marketplace distribution

### Problems
- **Coverage gate is not enforced** — `--coverage` fails but `npm test` (vitest run) doesn't run coverage
- Nightly E2E workflow exists but E2E tests are `describe.skip` — they never run
- No dependency caching optimization beyond `actions/setup-node` cache
- No Dockerfile for containerized deployment
- No `.dockerignore`
- No automated canary / smoke test after release
- Version bump is manual (no `standard-version` or `semantic-release`)
- Release workflow references `CHANGELOG.md` as body_path but doesn't verify it exists
- No automated rollback on test failure
- `publish.yml` calls `bash scripts/publish.sh` but that's not in the `npm run` scripts

### Grade: 6/10
**Next:** Enable coverage enforce in CI, activate E2E tests as nightly smoke suite, add Dockerfile, add semantic-release for automated versioning.
