# Repo Monitor

Repo Monitor is a Next.js and Convex dashboard for reviewing the health of GitHub repositories in one place. Connect a GitHub personal access token, sync accessible repositories, and scan up to 10 repositories at a time.

## Features

- Sync public and private repositories available to the connected GitHub account.
- Refresh the stored repository list from GitHub on demand without reconnecting the token.
- Show the last completed build result as `Build passed` or `Build failed`.
- Detect active GitHub-integrated deployments and show `Deployed` or `Not deployed`, including the environment and deployment link when available.
- Display build and deployment information in one compact row, for example:

  ```text
  Build passed / Deployed (Production)
  ```

- Check dependencies from `package.json` against the npm registry.
- Evaluate repository health checks for tests, GitHub Actions workflows, README presence and freshness, Dependabot configuration, and security alerts.
- Filter repositories that need attention and inspect detailed findings.
- Run single-repository, selected-repository, and weekly scheduled scans.
- Preserve partial scan results when one repository or external API request fails.

## Build and deployment status

Build status comes from GitHub check runs and commit statuses for the latest commit on the repository's default branch.

- Only completed results are displayed.
- If the newest build is still running, the previous completed pass/fail result remains visible.
- If GitHub does not expose build information, no build label is shown.

Deployment status comes from GitHub deployment records and their latest statuses.

- `Deployed` means GitHub reports at least one active successful, non-transient deployment.
- `Not deployed` is shown only when GitHub provides enough deployment history to determine that no active deployment exists.
- A failed newer deployment does not hide an older successful deployment that remains active.
- If the repository is deployed outside GitHub's deployment integrations, or the token cannot read deployment data, no deployment label is shown.

## Getting started

### Requirements

- Node.js compatible with the versions declared by the installed packages
- npm
- A Convex project
- A GitHub personal access token

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a GitHub PAT, sync repositories, select up to 10 repositories, and start a scan.

### Environment variables

Create `.env.local` with your Convex deployment URL:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

The server-side API routes can optionally use a Convex admin key:

```bash
CONVEX_ADMIN_KEY=<your-convex-admin-key>
```

Do not commit `.env.local` or your GitHub token.

## GitHub token access

The token must be able to read every repository you want to monitor. Private repositories require repository read access. Build and deployment indicators also require access to GitHub checks, commit statuses, and deployments.

If a token lacks access to optional data, Repo Monitor leaves the corresponding indicator blank instead of treating the repository as failed or undeployed.

## Available commands

```bash
npm run dev        # Start Next.js and Convex development servers
npm run mcp        # Start the local read-only MCP server over stdio
npm run build      # Create a production Next.js build
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript without emitting files
npm test           # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## Local MCP server

Repo Monitor provides a read-only MCP server over stdio.
It exposes four tools: repository listing, health lookup, attention items,
and connection status. It reads Convex data and never returns credentials.

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud npm run mcp
```

Use `MCP_CONNECTION_KEY` to override the default connection and launch
`npx @modelcontextprotocol/inspector npm run mcp` for interactive testing.

## Architecture

- `app/` contains the Next.js App Router pages and API routes.
- `components/` contains the interactive dashboard UI.
- `convex/` contains the schema, GitHub scanning actions, persistence functions, tests, and weekly cron configuration.
- `app/manual/` contains the in-app usage guide.

Scan results are stored in Convex and streamed back to the dashboard. GitHub and npm requests run on the backend so access tokens are not exposed to the browser.

## Deployment

Build the frontend with:

```bash
npm run build
```

Deploy the Convex backend for the target environment and configure `NEXT_PUBLIC_CONVEX_URL` in the frontend host. The Next.js application can be hosted on Vercel or another platform that supports Next.js 16.
