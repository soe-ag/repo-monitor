# Repo Health Scan Manual

## What Scan Does

A scan checks each selected repository and stores a health snapshot.

For each repository, it currently does these checks:

1. Package update checks

- Tries to fetch `package.json` from the default branch.
- Reads `dependencies` and `devDependencies`.
- For each package, checks the latest npm version and its release date.
- Ignores patch releases as health warnings. Minor and major releases become warnings only after 90 days, so fresh releases can settle.
- Surfaces open GitHub Dependabot alerts immediately when the token can access them.

2. Checklist checks

- Tests configured: verifies `scripts.test` exists and is not a placeholder.
- CI/CD workflow: checks `.github/workflows` exists.
- README exists: checks `README.md` exists.
- README freshness: checks last commit date on `README.md` and marks stale if older than 6 months.
- Dependabot config: checks `.github/dependabot.yml` or `.github/dependabot.yaml`.

3. Repository summary

- Aggregates package + checklist statuses.
- Stores last scan status, time, errors, and findings.

## Scan Modes

1. Scan all repositories

- Queues scan jobs for all repositories returned by your GitHub token.

2. Scan single repository

- Queues a scan only for the selected repository card.

## Why You May See "Running In Background"

A scan can take time, especially for many repositories.

The dashboard auto-polls for updates for a period of time. If scanning still continues, UI may show that it is still running in background and stop active polling to avoid endless requests.

You can run scan again later or refresh to fetch latest saved results.

## Why Private Repos May Not Appear

1. Token permissions

- Classic PAT: requires `repo` scope for private repos.
- Fine-grained PAT: repo access must include private repos and required read permissions.
- Org repos may require SSO authorization.

2. UI filters

- `Needs attention` hides healthy repos.
- `From year` hides repos older than the selected threshold.

3. Data refresh

- Run `Scan all repositories` after updating token/permissions.

## Notes

- If `package.json` is missing, package update checks are skipped for that repo.
- The dashboard still runs checklist checks even without `package.json`.
