# Repo Monitor

Repo Monitor is a GitHub repository health dashboard built with Next.js 16 and Convex. Connect a GitHub personal access token (PAT), refresh the repositories it can access, and run scans from the dashboard.

## What it checks

- **Dependencies:** Reads `dependencies` and `devDependencies` from each repository's root `package.json`, then compares up to 300 packages with the npm registry. Findings classify available updates as patch, minor, or major. The package update policy can be set to any newer version, minor or major updates, or major updates only.
- **Repository practices:** Checks for a test script, GitHub Actions workflow, README and its freshness, and Dependabot configuration. A README is considered stale when its last commit was more than six months ago.
- **Security alerts:** Reports open GitHub Dependabot alerts when the token and repository expose them. If the data is unavailable, the finding is marked unknown.
- **Builds and deployments:** Shows the latest completed result GitHub exposes for the default branch, and active successful GitHub-integrated deployments. Indicators may be absent when GitHub has no data or the token cannot read it.

Scans can target one repository, selected repositories, or all repositories. You can filter results and open repository details from the dashboard. Weekly scheduled scans run through Convex cron jobs. If an API request fails, the scan preserves available results and reports partial or failed status.

## Getting started

### Requirements

- Node.js supported by the installed dependencies
- npm
- A Convex account and development deployment
- A GitHub PAT with access to the repositories you want to monitor

### Configure and run locally

Create `.env.local` in the project root and set the Convex deployment URL:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

The Next.js API routes can use a Convex admin key when required by your deployment configuration:

```bash
CONVEX_ADMIN_KEY=<your-convex-admin-key>
```

Install packages and start the frontend and Convex development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your PAT, and scan repositories. The in-app guide is available at `/manual`.

The GitHub token is submitted to the backend and stored by Convex. Keep `.env.local`, Convex admin keys, and PATs private; environment files are ignored by Git.

## GitHub access

The PAT needs permission to read the repositories you want to monitor. Access to checks, commit statuses, deployments, and Dependabot alerts depends on the token's permissions and the repository's settings. When optional GitHub data is unavailable, Repo Monitor reports it as unknown or leaves its indicator blank rather than treating it as a failure.

## Commands

```bash
npm run dev        # Start the frontend and Convex development server
npm run dev:frontend # Start only the Next.js frontend
npm run dev:backend  # Start only the Convex development server
npm run mcp        # Start the local read-only MCP server over stdio
npm run build      # Create a production Next.js build
npm run start      # Serve the production build
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript without emitting files
npm test           # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## MCP server

The local read-only MCP server exposes four tools: `list_repositories`, `get_repository_health`, `list_attention_items`, and `get_connection_status`. It reads the default Repo Monitor connection from Convex and does not return credentials.

Set `NEXT_PUBLIC_CONVEX_URL` before starting it:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud npm run mcp
```

The connection key defaults to `default`; set `MCP_CONNECTION_KEY` to read a different connection. To inspect the server interactively, run `npx @modelcontextprotocol/inspector npm run mcp` with the same environment configured.

## Project layout

- `app/` contains the dashboard, manual, shared layout, and API routes.
- `components/` contains the dashboard and reusable UI components.
- `convex/` contains the database schema, GitHub integration and scans, scheduled jobs, and backend tests.
- `mcp/` contains the read-only MCP server and its Convex data source.
- `docs/` contains project learning notes and architecture decisions.

## Deployment

Deploy the Convex backend to the target environment and set `NEXT_PUBLIC_CONVEX_URL` for the Next.js host. Deploy the Next.js app to Vercel or another host that supports Next.js 16. Convex scheduled scans run when the deployed backend's cron job is active.

Build the frontend with:

```bash
npm run build
```
