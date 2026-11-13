'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ModeToggle } from '@/components/mode-toggle'
import {
  getDemoRepositories,
  getDemoScanHistory,
  recordDemoScan,
  saveDemoRepositories,
} from '@/components/demo-repositories'
import {
  checklistLabels,
  type ChecklistFinding,
  type PackageFinding,
  type RepositoryHealthCard,
} from '@/components/repo-health-model'

type HistoryEntry = {
  _id: string
  startedAt: number
  finishedAt?: number
  status: string
  repositoryStatus: string
  packageUpdateCount: number
  checklistIssueCount: number
  errorSummary?: string
}

type RepositoryDetails = {
  repository: RepositoryHealthCard
  packageFindings: PackageFinding[]
  checklistFindings: ChecklistFinding[]
  history: HistoryEntry[]
}

const checkDescriptions: Record<string, string> = {
  'tests-configured': 'A test script helps catch regressions before changes ship.',
  'cicd-workflow': 'GitHub Actions can run repeatable checks on every pull request.',
  'readme-exists': 'A README gives contributors a starting point for setup and usage.',
  'readme-freshness': 'Recently maintained setup docs are less likely to mislead contributors.',
  'dependabot-config': 'Dependabot can propose dependency updates automatically.',
  'security-advisories': 'Open Dependabot alerts may identify packages with known vulnerabilities.',
}

function statusClass(status: string) {
  if (status === 'ok' || status === 'completed' || status === 'passing') return 'text-emerald-700 dark:text-emerald-400'
  if (status === 'unknown' || status === 'running') return 'text-muted-foreground'
  return 'text-amber-700 dark:text-amber-400'
}

function demoHistory(repositoryId: string, repository: RepositoryHealthCard): HistoryEntry[] {
  const recordedHistory = getDemoScanHistory(repositoryId)
  if (recordedHistory.length > 0) return recordedHistory
  if (!repository.lastScanAt) return []
  const day = 24 * 60 * 60 * 1000
  const issueCount = repository.checklistFindings.filter((finding) =>
    ['warning', 'missing', 'stale', 'error'].includes(finding.status)
  ).length
  const updateCount = repository.packageFindings.filter((finding) => finding.status === 'warning').length
  const current = {
    _id: `${repositoryId}-run-current`,
    startedAt: repository.lastScanAt,
    finishedAt: repository.lastScanAt + 30_000,
    status: 'completed',
    repositoryStatus: repository.lastScanStatus ?? 'unknown',
    packageUpdateCount: updateCount,
    checklistIssueCount: issueCount,
  }
  return [current, { ...current, _id: `${repositoryId}-run-previous`, startedAt: repository.lastScanAt - 7 * day, finishedAt: repository.lastScanAt - 7 * day + 40_000, packageUpdateCount: Math.max(0, updateCount - 1) }]
}

function actionForChecklist(repository: RepositoryHealthCard, checkKey: string) {
  const base = `${repository.htmlUrl}/tree/${encodeURIComponent(repository.defaultBranch)}`
  if (checkKey === 'dependabot-config') {
    return { href: `${repository.htmlUrl}/new/${encodeURIComponent(repository.defaultBranch)}?filename=.github/dependabot.yml`, label: 'Add Dependabot config' }
  }
  if (checkKey === 'tests-configured') {
    return { href: `${repository.htmlUrl}/blob/${encodeURIComponent(repository.defaultBranch)}/package.json`, label: 'Review project config' }
  }
  if (checkKey === 'cicd-workflow') return { href: `${base}/.github/workflows`, label: 'Add or review workflow' }
  if (checkKey === 'readme-exists' || checkKey === 'readme-freshness') {
    return { href: `${repository.htmlUrl}/blob/${encodeURIComponent(repository.defaultBranch)}/README.md`, label: 'Review README' }
  }
  if (checkKey === 'security-advisories') return { href: `${repository.htmlUrl}/security/dependabot`, label: 'Review security alerts' }
  return { href: repository.htmlUrl, label: 'Open repository' }
}

export function RepositoryDetail({ repositoryId }: { repositoryId: string }) {
  const [details, setDetails] = useState<RepositoryDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadDetails = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (window.sessionStorage.getItem('repo-monitor-demo-mode') === 'true' && repositoryId.startsWith('demo-')) {
      const repository = getDemoRepositories().find((item) => item._id === repositoryId)
      if (repository) {
        setDetails({ repository, packageFindings: repository.packageFindings, checklistFindings: repository.checklistFindings, history: demoHistory(repositoryId, repository) })
        setLoading(false)
        return
      }
    }
    try {
      const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}`)
      const payload = (await response.json()) as RepositoryDetails | { error: string }
      if (!response.ok || 'error' in payload) throw new Error('error' in payload ? payload.error : 'Repository could not be loaded')
      setDetails(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Repository could not be loaded')
    } finally {
      setLoading(false)
    }
  }, [repositoryId])

  useEffect(() => { void loadDetails() }, [loadDetails])

  async function scanRepository() {
    setScanning(true)
    setMessage(null)
    if (window.sessionStorage.getItem('repo-monitor-demo-mode') === 'true') {
      const currentRepository = details?.repository
      if (!currentRepository) {
        setScanning(false)
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 650))
      const scannedAt = Date.now()
      const updatedRepository = { ...currentRepository, lastScanAt: scannedAt }
      const updatedRepositories = getDemoRepositories().map((item) =>
        item._id === repositoryId ? updatedRepository : item
      )
      saveDemoRepositories(updatedRepositories)
      recordDemoScan(updatedRepository, scannedAt)
      setDetails((previous) => previous ? {
        ...previous,
        repository: updatedRepository,
        history: getDemoScanHistory(repositoryId),
      } : previous)
      setMessage('Demo scan completed. This sample result is stored only for this browser session; no GitHub or backend requests were made.')
      setScanning(false)
      return
    }
    try {
      const response = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', repositoryId }),
      })
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string }
      if (!response.ok || payload.ok === false || payload.error) throw new Error(payload.error ?? payload.message ?? 'Could not start scan')
      setMessage('Scan queued. Refresh this page in a moment to see the new result and history entry.')
    } catch (scanError) {
      setMessage(scanError instanceof Error ? scanError.message : 'Could not start scan')
    } finally {
      setScanning(false)
    }
  }

  const repository = details?.repository
  const packageFindings = details?.packageFindings ?? []
  const checklistFindings = details?.checklistFindings ?? []
  const actionablePackageFindings = packageFindings.filter((finding) => finding.status === 'warning')
  const actionableChecklistFindings = checklistFindings.filter((finding) =>
    ['warning', 'missing', 'stale', 'error'].includes(finding.status)
  )

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Repository workspace</Link>
        <div className="flex items-center gap-2"><ModeToggle /><Button asChild variant="outline" size="sm"><a href={repository?.htmlUrl ?? '#'} target="_blank" rel="noreferrer">GitHub <ExternalLink className="ml-1 size-3.5" /></a></Button></div>
      </header>

      {loading ? <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading repository report…</CardContent></Card> : null}
      {error ? <Card><CardContent className="py-8 text-sm text-destructive">{error}. Return to the workspace and confirm GitHub is connected.</CardContent></Card> : null}
      {repository ? <>
        <section className="rounded-2xl border border-border/60 bg-linear-to-br from-card to-muted/20 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Repository report · {repository.visibility}</p>
              <h1 className="mt-1 font-heading text-3xl tracking-tight">{repository.fullName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Default branch <code className="rounded bg-muted px-1.5 py-0.5">{repository.defaultBranch}</code>{repository.primaryLanguage ? ` · ${repository.primaryLanguage}` : ''}{repository.packageManager ? ` · ${repository.packageManager}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={repository.lastScanStatus === 'ok' ? 'default' : 'outline'}>{repository.lastScanAt ? repository.lastScanStatus : 'Not scanned'}</Badge>
              <Button onClick={scanRepository} disabled={scanning}><RefreshCw className={`mr-2 size-4 ${scanning ? 'animate-spin' : ''}`} />{scanning ? 'Scanning…' : 'Scan now'}</Button>
            </div>
          </div>
          {message ? <p role="status" className="mt-4 rounded-lg bg-muted/70 px-3 py-2 text-sm">{message}</p> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Dependency updates" value={actionablePackageFindings.length} />
            <Metric label="Checklist items to review" value={actionableChecklistFindings.length} />
            <Metric label="Last scanned" value={repository.lastScanAt ? new Date(repository.lastScanAt).toLocaleString() : 'Never'} />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader><CardTitle>Recommended next steps</CardTitle><CardDescription>Prioritized from the latest scan findings.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {actionablePackageFindings.length === 0 && actionableChecklistFindings.length === 0 && repository.latestCommitBuildStatus !== 'failing' ? <p className="rounded-lg bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-300">No required actions found. Keep the repository current with regular scans.</p> : null}
              {actionablePackageFindings.map((finding) => <div key={finding._id} className="rounded-xl border border-border/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Update {finding.packageName}</p><Badge variant="outline">{finding.updateType} update</Badge></div><p className="mt-1 text-sm text-muted-foreground">{finding.currentVersion} → {finding.latestVersion}. Review the release notes and compatibility before updating.</p><a className="mt-3 inline-flex text-sm font-medium underline underline-offset-4" href={`https://www.npmjs.com/package/${encodeURIComponent(finding.packageName)}`} target="_blank" rel="noreferrer">Review package releases <ExternalLink className="ml-1 size-3.5" /></a></div>)}
              {actionableChecklistFindings.map((finding) => { const action = actionForChecklist(repository, finding.checkKey); return <div key={finding._id} className="rounded-xl border border-border/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{checklistLabels[finding.checkKey] ?? finding.checkKey.replaceAll('-', ' ')}</p><Badge variant="outline">{finding.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{finding.detail || checkDescriptions[finding.checkKey] || 'Review this repository practice.'}</p><p className="mt-2 text-xs text-muted-foreground">{checkDescriptions[finding.checkKey]}</p><a className="mt-3 inline-flex text-sm font-medium underline underline-offset-4" href={action.href} target="_blank" rel="noreferrer">{action.label} <ExternalLink className="ml-1 size-3.5" /></a></div> })}
              {repository.latestCommitBuildStatus === 'failing' ? <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4"><p className="font-semibold">Fix the failing build</p><p className="mt-1 text-sm text-muted-foreground">{repository.latestCommitBuildDetail || 'The latest commit checks failed.'}</p>{repository.latestCommitUrl ? <a className="mt-3 inline-flex text-sm font-medium underline underline-offset-4" href={repository.latestCommitUrl} target="_blank" rel="noreferrer">Inspect failing commit <ExternalLink className="ml-1 size-3.5" /></a> : null}</div> : null}
              {repository.latestDeploymentStatus === 'not-deployed' ? <div className="rounded-xl border border-border/60 p-4"><p className="font-semibold">Review deployment setup</p><p className="mt-1 text-sm text-muted-foreground">{repository.latestDeploymentDetail || 'No successful deployment was found.'}</p><a className="mt-3 inline-flex text-sm font-medium underline underline-offset-4" href={`${repository.htmlUrl}/deployments`} target="_blank" rel="noreferrer">Inspect deployments <ExternalLink className="ml-1 size-3.5" /></a></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Scan history</CardTitle><CardDescription>Recent scans for this repository, newest first.</CardDescription></CardHeader>
            <CardContent>
              {details.history.length === 0 ? <p className="text-sm text-muted-foreground">No scan history yet. Run the first scan to establish a baseline.</p> : <ol className="space-y-0">{details.history.map((run, index) => <li key={run._id} className="relative border-l border-border/70 pb-5 pl-4 last:border-l-transparent last:pb-0"><span className={`absolute -left-1.5 top-1 size-3 rounded-full border-2 border-background ${run.repositoryStatus === 'ok' ? 'bg-emerald-500' : run.repositoryStatus === 'unknown' ? 'bg-muted-foreground' : 'bg-amber-500'}`} /><p className="text-sm font-semibold">{new Date(run.startedAt).toLocaleString()}</p><p className={`mt-1 text-xs capitalize ${statusClass(run.repositoryStatus)}`}>{run.repositoryStatus} · {run.packageUpdateCount} package updates · {run.checklistIssueCount} checklist issues</p>{run.errorSummary ? <p className="mt-1 text-xs text-destructive">{run.errorSummary}</p> : null}</li>)}</ol>}
            </CardContent>
          </Card>
        </section>

        <Card><CardHeader><CardTitle>All latest findings</CardTitle><CardDescription>“Unknown” means the source did not provide enough data to make a reliable pass or fail call.</CardDescription></CardHeader><CardContent><div className="grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Dependencies</h3>{packageFindings.length === 0 ? <p className="text-sm text-muted-foreground">No dependency findings. This repository may not contain a package.json.</p> : <ul className="space-y-2">{packageFindings.map((finding) => <li key={finding._id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"><span><span className="font-medium">{finding.packageName}</span><span className="block text-xs text-muted-foreground">{finding.currentVersion} → {finding.latestVersion}</span></span><span className={`shrink-0 text-xs font-medium capitalize ${statusClass(finding.status)}`}>{finding.updateType === 'none' ? 'current' : finding.updateType}</span></li>)}</ul>}</div><div><h3 className="mb-2 text-sm font-semibold">Repository practices</h3>{checklistFindings.length === 0 ? <p className="text-sm text-muted-foreground">No checklist results available yet.</p> : <ul className="space-y-2">{checklistFindings.map((finding) => <li key={finding._id} className="rounded-lg border border-border/60 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium capitalize">{finding.checkKey.replaceAll('-', ' ')}</span><span className={`text-xs font-semibold capitalize ${statusClass(finding.status)}`}>{finding.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{finding.detail || checkDescriptions[finding.checkKey] || 'No extra detail was returned.'}</p></li>)}</ul>}</div></div></CardContent></Card>
      </> : null}
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}
