'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Gauge, PackageCheck, ShieldAlert } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Card, CardContent } from '@/components/ui/card'
import { getDashboardSummary, type RepositoryHealthCard } from '@/components/repo-health-model'

export function RepoSummaryDashboard() {
  const [repositories, setRepositories] = useState<RepositoryHealthCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadRepositories() {
      try {
        const response = await fetch('/api/scans')
        const payload = (await response.json()) as RepositoryHealthCard[] | { error: string }
        if (!response.ok || 'error' in payload) {
          throw new Error('error' in payload ? payload.error : 'Unable to load repositories')
        }
        if (active) {
          setRepositories(payload)
          setError(null)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load repositories')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRepositories()
    return () => {
      active = false
    }
  }, [])

  const summary = useMemo(() => getDashboardSummary(repositories), [repositories])

  return (
    <main className="mx-auto flex w-full max-w-8xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Repository health
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight sm:text-4xl">Summary dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A quick read on coverage, health, and the work waiting across your repositories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-full border border-border/70 bg-background/80 px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Home
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground" role="status">
          Loading repository summary...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive" role="alert">
          {error}. Return home to connect GitHub or retry the repository load.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Fleet snapshot
              </p>
              <h2 className="font-heading text-xl tracking-tight sm:text-2xl">What needs your attention?</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.scanned} of {summary.total} repositories scanned
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Healthy repos" icon={<Gauge className="size-4" aria-hidden />}>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{summary.healthy}</span>
                <span className="text-xs text-muted-foreground">
                  {summary.healthPercent === null ? '—' : `${summary.healthPercent}% of scanned`}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${summary.healthPercent ?? 0}%` }}
                />
              </div>
            </SummaryCard>

            <SummaryCard
              label="Needs attention"
              icon={<ShieldAlert className="size-4" aria-hidden />}
              className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/70 dark:bg-amber-950/15"
              iconClassName="text-amber-800 dark:text-amber-300"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{summary.needsAttention}</span>
                <span className="text-xs text-muted-foreground">scanned repos</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {summary.failingBuilds} failing build{summary.failingBuilds === 1 ? '' : 's'}
                {summary.notDeployed > 0 ? ` · ${summary.notDeployed} not deployed` : ''}
              </p>
            </SummaryCard>

            <SummaryCard label="Dependency updates" icon={<PackageCheck className="size-4" aria-hidden />}>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{summary.dependencyUpdates}</span>
                <span className="text-xs text-muted-foreground">available</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Across all latest scans</p>
            </SummaryCard>

            <SummaryCard label="Scan coverage" icon={<CheckCircle2 className="size-4" aria-hidden />}>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{summary.scanned}</span>
                <span className="text-xs text-muted-foreground">of {summary.total}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {summary.unscanned === 0
                  ? 'Everything is covered'
                  : `${summary.unscanned} repo${summary.unscanned === 1 ? '' : 's'} waiting for a first scan`}
              </p>
            </SummaryCard>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm shadow-sm">
            <p className="font-semibold">Want to act on these numbers?</p>
            <p className="mt-1 text-muted-foreground">
              Open the home view to filter repositories, select a scan set, and inspect individual findings.
            </p>
            <Link href="/" className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4">
              Open repository workspace →
            </Link>
          </div>
        </>
      )}
    </main>
  )
}

function SummaryCard({
  label,
  icon,
  children,
  className,
  iconClassName,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
  iconClassName?: string
}) {
  return (
    <Card className={`gap-2 border-border/60 py-4 shadow-sm ${className ?? ''}`}>
      <CardContent className="px-4">
        <div className={`flex items-center justify-between text-muted-foreground ${iconClassName ?? ''}`}>
          <span className="text-xs font-medium">{label}</span>
          {icon}
        </div>
        <div className="mt-2">{children}</div>
      </CardContent>
    </Card>
  )
}
