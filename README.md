This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development servers:

```bash
npm install
npm run dev
```

Set environment variables before running:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
# Optional for server-side API route calls:
CONVEX_ADMIN_KEY=<your-convex-admin-key>
```

## Repo health monitor (Phase 1 + 2)

Implemented foundations:

- GitHub PAT connection flow with validation and connection status (`connected`, `invalid`, `rate-limited`)
- Convex schema for connections, repositories, package findings, checklist findings, and scan runs
- Scanner actions for:
  - syncing accessible private/public repositories
  - parsing `package.json` dependencies
  - checking newer package versions
  - checklist evaluation (tests, CI workflow, README, README freshness, Dependabot)
- Partial-failure scan behavior with per-repo error recording
- Weekly scheduled scan via Convex cron and manual scan triggers via UI/API

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
