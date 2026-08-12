import Link from 'next/link'

export default function ManualPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-border/60 bg-linear-to-br from-card to-muted/20 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl leading-tight tracking-tight">
              Repo Health Manual
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Learn how to connect GitHub, scan repositories, and understand every step of the scan
              process.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full border border-border/70 px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            ← Home
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Add a GitHub PAT Token</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open the home dashboard.</li>
          <li>
            In the GitHub connection card, paste your Personal Access Token (classic or
            fine-grained).
          </li>
          <li>
            Click <strong className="text-foreground">Connect GitHub</strong>.
          </li>
          <li>For private repositories, ensure the PAT has repository read access.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">2. Select Repositories to Scan</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Use the checkbox on each repository card to select it.</li>
          <li>You can select at most 10 repositories per scan run.</li>
          <li>
            Use <strong className="text-foreground">Select last 10</strong> to quickly pick the 10
            most recently updated repos.
          </li>
          <li>
            Use <strong className="text-foreground">Unselect all</strong> to clear your selection.
          </li>
          <li>
            Click <strong className="text-foreground">Scan selected</strong> to start a batch scan.
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">3. Scan One Specific Repository</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Click the scan (reload) icon button on any repository card.</li>
          <li>Only that single repository is scanned immediately.</li>
          <li>The status bar updates in real time — no page refresh needed.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">4. How a Scan Works — Step by Step</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          When you trigger a scan (single or batch), the following steps happen automatically:
        </p>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Authenticate</strong> — The system verifies your
            GitHub token is valid and connected before doing anything else.
          </li>
          <li>
            <strong className="text-foreground">Create a scan run record</strong> — A new scan run
            entry is saved in the database with status{' '}
            <code className="rounded bg-muted px-1 text-xs">running</code>, so the dashboard can
            track progress.
          </li>
          <li>
            <strong className="text-foreground">Fetch package.json from GitHub</strong> — For each
            repository, the scanner requests the{' '}
            <code className="rounded bg-muted px-1 text-xs">package.json</code> file directly from
            the GitHub API using the default branch. If the file does not exist, the repo is marked
            accordingly and the dependency scan step is skipped.
          </li>
          <li>
            <strong className="text-foreground">Check every dependency against npm</strong> — All
            packages listed under{' '}
            <code className="rounded bg-muted px-1 text-xs">dependencies</code> and{' '}
            <code className="rounded bg-muted px-1 text-xs">devDependencies</code> are looked up on
            the npm registry to find the latest published version. Up to 300 packages are scanned
            per repository. Each package is classified as <em>none</em>, <em>patch</em>,{' '}
            <em>minor</em>, or <em>major</em> update.
          </li>
          <li>
            <strong className="text-foreground">Run checklist checks</strong> — Five health checks
            are evaluated for every repository:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Tests configured</strong> — looks for a{' '}
                <code className="rounded bg-muted px-1 text-xs">test</code> script in package.json.
              </li>
              <li>
                <strong className="text-foreground">CI/CD workflow</strong> — checks whether a{' '}
                <code className="rounded bg-muted px-1 text-xs">.github/workflows</code> directory
                exists.
              </li>
              <li>
                <strong className="text-foreground">README exists</strong> — checks whether
                README.md is present.
              </li>
              <li>
                <strong className="text-foreground">README freshness</strong> — looks at the last
                commit date of README.md; flags it as stale if it has not been updated in a long
                time.
              </li>
              <li>
                <strong className="text-foreground">Dependabot config</strong> — checks whether a
                Dependabot configuration file exists.
              </li>
            </ul>
          </li>
          <li>
            <strong className="text-foreground">Compute overall health status</strong> — All
            individual package and checklist statuses are combined into a single repository status:
            ok, warning, missing, stale, or error.
          </li>
          <li>
            <strong className="text-foreground">Save results</strong> — Findings are written to the
            database and linked to the repository. The repository card on the dashboard updates
            immediately.
          </li>
          <li>
            <strong className="text-foreground">Finalize the scan run</strong> — The scan run record
            is updated to <code className="rounded bg-muted px-1 text-xs">completed</code>,{' '}
            <code className="rounded bg-muted px-1 text-xs">partial</code>, or{' '}
            <code className="rounded bg-muted px-1 text-xs">failed</code> with counts of successes
            and failures.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          The dashboard polls for updates every few seconds while a scan is running and shows live
          progress in the status bar — including the name of the repository currently being
          processed.
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">5. Reading the Results</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Card badge</strong> — shows the overall health
            status: ok (green), warning/stale/missing (amber), or error (red).
          </li>
          <li>
            <strong className="text-foreground">Open details</strong> — click the detail icon on a
            card to see a full list of outdated packages and any failing checklist items.
          </li>
          <li>
            <strong className="text-foreground">Filter: Has package.json</strong> — use this filter
            to hide older repos that contain only HTML/JS files with no package.json, so you can
            focus on Node/JS projects.
          </li>
          <li>
            <strong className="text-foreground">Filter: Needs attention</strong> — shows only repos
            with at least one warning, missing, stale, or error finding.
          </li>
          <li>
            <strong className="text-foreground">Filter: npm or pnpm</strong> shows only
            repositories using the selected package manager. Package managers are detected during
            repository scans.
          </li>
        </ul>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="rounded-full border border-border/70 px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  )
}
