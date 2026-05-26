# Repo Monitor Feature and Improvement Roadmap

This list is tailored to the current implementation (Next.js + Convex, PAT-based connection, scan dashboard, weekly cron, and checklist/package findings).

## 1) High-impact product features

### 1.1 Trend and history view (per repo)

- Add history charts for health status over time (weekly/monthly).
- Show regression alerts (for example, repo moved from `ok` to `warning`).
- Benefit: turns point-in-time scans into actionable trends.

### 1.2 Team and multi-account support

- Support multiple GitHub connections (personal + org accounts).
- Add workspace/team model with role-based access (`owner`, `editor`, `viewer`).
- Benefit: makes the app usable for teams, not only single users.

### 1.3 Notification system

- Add notifications for newly detected major dependency updates, missing CI, stale README, and failed scans.
- Delivery channels: in-app inbox, email digest, Slack webhook.
- Benefit: users do not need to open the dashboard continuously.

### 1.4 Rule customization per repository

- Allow per-repo overrides for package policy and checklist thresholds.
- Add custom checklist rules (for example, branch protection, CODEOWNERS, SECURITY.md).
- Benefit: avoids one-size-fits-all checks across very different repos.

### 1.5 Smart prioritization score

- Compute a health score with weighted checks (security > docs > freshness, etc.).
- Sort by risk and expected impact.
- Benefit: helps users focus on what matters most first.

## 2) Scanning and analysis improvements

### 2.1 Incremental scanning

- Scan only repos changed since last successful scan using `pushed_at` and commit metadata.
- Keep full-scan option for manual override.
- Benefit: much faster and cheaper routine scans.

### 2.2 Queue + concurrency controls

- Add an internal job queue with bounded concurrency and retry strategy.
- Separate scan orchestration from API request lifecycle.
- Benefit: improves reliability on large repo sets and avoids timeout pressure.

### 2.3 Better package intelligence

- Include peerDependencies and optionalDependencies.
- Flag abandoned packages and npm deprecations.
- Add release-age checks (for example, major update available for > 90 days).
- Benefit: richer dependency health signal.

### 2.4 Security signal integration

- Add GitHub security advisory/Dependabot alert ingestion.
- Add license risk checks and optional policy gates.
- Benefit: turns the dashboard into practical risk monitoring.

### 2.5 Rich scan diagnostics

- Store structured scan errors (auth, rate limit, not found, parse error, network).
- Add per-check execution time and retry count.
- Benefit: easier debugging and better user trust.

## 3) UX and dashboard improvements

### 3.1 Drill-down pages

- Add dedicated repository detail page with tabs:
  - Overview
  - Dependencies
  - Checklist
  - Scan history
  - Errors
- Benefit: better information architecture than modal-only detail.

### 3.2 Bulk actions

- Bulk select repos by filter (for example, all warning repos, all private repos).
- Bulk apply policy changes and trigger scans.
- Benefit: better workflow efficiency.

### 3.3 Saved views and advanced filters

- Save custom filters (status + language + age + visibility).
- Add quick filter chips and search by owner/name.
- Benefit: faster repeat analysis.

### 3.4 Comparative dashboards

- Show health by language, owner, and visibility.
- Show top recurring checklist failures across repos.
- Benefit: better portfolio-level insight.

### 3.5 Export and reports

- Export CSV/JSON/PDF summaries.
- Weekly digest report with changes since last scan.
- Benefit: supports management reporting and audits.

## 4) Reliability, security, and compliance

### 4.1 OAuth + token hardening

- Add GitHub OAuth flow in addition to PAT.
- Encrypt tokens at rest and rotate encryption keys safely.
- Benefit: better security posture and enterprise readiness.

### 4.2 API hardening

- Add request validation schemas for all API routes.
- Add rate limiting and abuse protection per endpoint.
- Benefit: safer public deployment.

### 4.3 Auditing and traceability

- Add audit log for connection changes, policy updates, scans, and deletes.
- Track actor identity for each action.
- Benefit: operational transparency and accountability.

### 4.4 Observability

- Add structured logs, metrics, and error tracking integration.
- Track scan duration percentiles and failure rates.
- Benefit: easier operations and incident response.

### 4.5 Data retention strategy

- Keep scan summaries long-term and prune raw findings after configurable TTL.
- Add archive/export before deletion.
- Benefit: controls storage growth while preserving useful history.

## 5) Performance and architecture

### 5.1 Server-side caching and ETags

- Cache stable dashboard reads and support conditional requests.
- Benefit: lower backend and frontend load.

### 5.2 Pagination and virtualized rendering

- Add pagination/cursor loading for large repo sets.
- Virtualize large card lists.
- Benefit: smoother UI at scale.

### 5.3 Denormalized dashboard snapshots

- Maintain precomputed per-repo dashboard summaries.
- Update snapshot on scan completion.
- Benefit: faster read queries and smaller payloads.

### 5.4 Parallel package lookups with guardrails

- Use controlled concurrency for npm version checks.
- Add short-lived cache for package latest versions.
- Benefit: faster scans and reduced duplicate network work.

### 5.5 Background processing boundaries

- Keep API endpoints thin and push heavy jobs into background workers/actions.
- Benefit: fewer request timeouts and cleaner architecture.

## 6) Testing and developer experience

### 6.1 Expand test coverage to API routes and scan orchestration

- Add route tests for [app/api/scans/route.ts](app/api/scans/route.ts) and [app/api/github-connection/route.ts](app/api/github-connection/route.ts).
- Add orchestration tests for partial failure and retry behavior.
- Benefit: less regression risk on core flows.

### 6.2 Contract tests for GitHub and npm adapters

- Add fixtures for edge cases (rate limits, malformed package.json, archived repos).
- Benefit: robust external API integrations.

### 6.3 E2E tests for critical user journeys

- Cover connect token, scan selected repos, inspect details, change package policy, delete connection.
- Benefit: validates real workflow behavior.

### 6.4 Quality gates in CI

- Add stricter CI matrix: lint, typecheck, unit tests, integration tests, build.
- Add minimum coverage thresholds.
- Benefit: stable merges and predictable releases.

### 6.5 Local developer tooling

- Add seed scripts and mock GitHub data mode for fast local demos.
- Add one-command setup docs for new contributors.
- Benefit: faster onboarding and debugging.

## 7) Suggested implementation order

### Phase A: Quick wins (1-2 weeks)

- Drill-down page, saved filters, richer diagnostics, API validation, route tests.

### Phase B: Scale and trust (2-4 weeks)

- Incremental scanning, queue/concurrency controls, observability, snapshot reads.

### Phase C: Team and enterprise (4+ weeks)

- Multi-account/workspace model, notifications, OAuth hardening, compliance features.

## 8) Optional stretch features

- AI-generated fix suggestions per failed checklist item.
- Automated pull request creation for low-risk upgrades.
- Benchmark mode comparing health score across selected organizations.
