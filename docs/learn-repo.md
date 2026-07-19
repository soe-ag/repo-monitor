# Learn `repo-monitor`

## Read in this order

1. `convex/schema.ts` — GitHub connections, imported repositories, scan runs, package findings, and checklist findings.
2. `convex/constants.ts`, `checklist.ts`, and `github.ts` — health-status policy, README/test checks, GitHub/NPM integration, and update classification.
3. `convex/githubConnections.ts` — connect, validate, save, and refresh a credential.
4. `convex/scans.ts` — repository import, scan-run persistence, single/all/scheduled scan orchestration.
5. `components/repo-health-setup.tsx`, then `app/page.tsx` — setup/dashboard ownership; read API routes last for browser-to-Convex bridging.
6. `convex/*.test.ts` and `components/repo-health-setup.test.tsx` — behavior confirmation.

## Function map and UI trace

- `githubConnections.ts`: state/lookups, connection CRUD, `connectWithPat`, and profile refresh. The setup component uses the HTTP integration rather than direct `api.*` hooks.
- `scans.ts`: dashboard queries plus `triggerScanAll`, `triggerScanSingleRepository`, `runScheduledScan`, `scanSingleRepository`, and `scanAllRepositories`. UI/API entry points: `app/page.tsx`, `app/api/scans/route.ts`, and `app/api/github-connection/route.ts`.
- `checklist.ts`: pure test/readme evaluation and status summarization; no UI ownership, but it determines scan findings.
- `github.ts`: GitHub and NPM network adapters plus version policy classification; it is a leaf dependency of scan actions.

## Orchestration and local state

`app/page.tsx` owns the dashboard shell. `repo-health-setup.tsx` owns connection setup and uses browser fetches; `lib/convexHttp.ts` is the client bridge. The important derived logic is backend-first: checklist evaluation and package-version classification.

## If you understand these files, you understand the repo

`convex/schema.ts`, `convex/githubConnections.ts`, `convex/scans.ts`, `convex/checklist.ts`, `convex/github.ts`, `components/repo-health-setup.tsx`, and `app/api/scans/route.ts`.
