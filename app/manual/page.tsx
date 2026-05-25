import Link from 'next/link'

export default function ManualPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-border/60 bg-linear-to-br from-card to-muted/20 p-6 shadow-sm">
        <h1 className="font-heading text-3xl leading-tight tracking-tight">Repo Health Manual</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Learn how to connect GitHub, scan repositories, and review missing checklist items.
        </p>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Add a GitHub PAT Token</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open the home dashboard.</li>
          <li>In GitHub connection, paste your Personal Access Token.</li>
          <li>Click Connect GitHub.</li>
          <li>For private repositories, ensure PAT permissions include repository read access.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">2. Select Repositories to Scan</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Use checkboxes on repository cards to select repos.</li>
          <li>You can select at most 10 repositories per scan.</li>
          <li>Use Select last 10 repos for a quick selection.</li>
          <li>Use Unselect all to clear the selection.</li>
          <li>Click Scan selected repos to run a batch scan.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">3. Scan One Specific Repository</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Click the scan icon on that repository card.</li>
          <li>Only that repository is queued for scanning.</li>
          <li>Refresh the page after processing to load the latest result.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">4. Check Missing Checklist Items</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Each scan checks these repository health items:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Tests configured in package scripts</li>
          <li>CI/CD workflow in .github/workflows</li>
          <li>README.md exists</li>
          <li>README freshness based on recent commits</li>
          <li>Dependabot config file exists</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Open the warning/details icon on any card to inspect checklist findings and required
          package updates.
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">5. Read Results Clearly</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Card status shows current scan summary.</li>
          <li>Last scan time appears beside each card scan button.</li>
          <li>Detail modal package list only shows packages that need updating.</li>
        </ul>
      </section>

      <div className="flex items-center justify-end">
        <Link
          href="/"
          className="rounded-full border border-border/70 px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
