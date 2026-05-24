## Plan: Repo Health Monitor V1

Build a GitHub repo health dashboard using your Next.js + Convex stack.  
V1 will connect GitHub, list private/public repos, check dependency freshness, and show checklist health (tests, CI/CD, README, README freshness, Dependabot).

### Why this approach

PAT authentication is the easiest to ship first.  
We keep the GitHub access layer abstracted so OAuth can be added later without rewriting scanner logic.

### Scope (V1)

- List all accessible repos (private + public)
- Show repo cards with:
  - repo name, visibility, last scan time
  - package update warnings (outdated dependencies)
  - checklist indicators
- Checklist items:
  - tests configured
  - CI/CD workflow exists in `.github/workflows`
  - `README.md` exists
  - README updated within 6 months
  - Dependabot config exists
- Scan modes:
  - weekly scheduled scan
  - manual `scan all`
  - manual per-repo refresh
- Package update policy:
  - configurable per user
  - default: flag when any newer version exists

### Phase Plan

#### Phase 0: Contracts and rules

1. Define status model: `ok`, `warning`, `missing`, `stale`, `error`, `unknown`
2. Define stale threshold for README as 180 days
3. Finalize package policy enum and defaults

#### Phase 1: GitHub connection

1. Implement PAT connection UI and backend storage
2. Validate PAT by test call to GitHub API
3. Show connection state (`connected`, `invalid`, `rate-limited`)
4. Add abstraction boundary for future OAuth token source

#### Phase 2: Convex backend

1. Add schema tables:
   - `githubConnections`
   - `repositories`
   - `packageFindings`
   - `checklistFindings`
   - `scanRuns`
2. Build scanner actions:
   - repo sync from GitHub
   - package.json fetch and parse
   - dependency version comparison
   - checklist evaluation
3. Add resilient scan behavior:
   - partial failure handling per repo
   - store per-repo scan errors
4. Add scheduled weekly scan and manual scan triggers

#### Phase 3: Frontend dashboard

1. Replace starter page with repo health dashboard
2. Render repo cards in a responsive grid
3. Add indicators:
   - outdated package count + per-package list
   - checklist checks/exclamation states
4. Add filters:
   - all
   - needs attention
   - healthy
5. Add scan actions:
   - scan all
   - scan single repo
6. Add loading, empty, and error states

#### Phase 4: Verification

1. Unit tests:
   - semver/update classification
   - checklist evaluators
2. Integration tests:
   - GitHub API ingestion and edge cases
3. UI tests:
   - card rendering and status display
4. CI validation:
   - lint
   - typecheck
   - tests
   - build

### Relevant files in current project

- `package.json` (dependencies/scripts)
- `convex/schema.ts` (new tables)
- `app/page.tsx` (dashboard UI)
- `components/ui/card.tsx` (repo card shell)
- `components/ui/badge.tsx` (status labels)
- `components/ui/skeleton.tsx` (loading states)
- `.github/workflows/ci.yml` (pipeline baseline)
- `AGENTS.md` (Next.js version caution)

### Decisions captured

- Include private + public repos
- Weekly schedule + manual refresh
- Checklist includes tests, CI, README, README freshness, Dependabot
- Package policy is user-configurable
- Start with PAT (easiest), keep OAuth-ready abstraction

### V1.1 recommendation

Add branch protection check as next checklist item.
