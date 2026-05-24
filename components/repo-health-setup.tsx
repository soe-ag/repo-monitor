'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type HealthStatus = 'ok' | 'warning' | 'missing' | 'stale' | 'error' | 'unknown'
type PackagePolicy = 'any-newer' | 'minor-or-major' | 'major-only'
type ConnectionStatus = 'connected' | 'invalid' | 'rate-limited'
type DashboardFilter = 'all' | 'needs-attention' | 'healthy'

type ConnectionState = {
  status: ConnectionStatus
  connected: boolean
  packagePolicy?: PackagePolicy
  rateLimitResetAt?: number
  lastValidatedAt?: number
  lastError?: string
}

type PackageFinding = {
  _id: string
  packageName: string
  currentVersion: string
  latestVersion: string
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown'
  status: HealthStatus
}

type ChecklistFinding = {
  _id: string
  checkKey: string
  status: HealthStatus
  detail?: string
}

type RepositoryHealthCard = {
  _id: string
  fullName: string
  visibility: 'public' | 'private'
  lastScanAt?: number
  lastScanStatus?: HealthStatus
  lastScanError?: string
  packageFindings: PackageFinding[]
  checklistFindings: ChecklistFinding[]
}

const packagePolicyOptions: Array<{ value: PackagePolicy; label: string }> = [
  { value: 'any-newer', label: 'Flag any newer package version' },
  { value: 'minor-or-major', label: 'Flag minor/major updates only' },
  { value: 'major-only', label: 'Flag major updates only' },
]

const checklistLabels: Record<string, string> = {
  'tests-configured': 'Tests',
  'cicd-workflow': 'CI/CD',
  'readme-exists': 'README',
  'readme-freshness': 'README freshness',
  'dependabot-config': 'Dependabot',
}

function statusBadgeVariant(status: HealthStatus | undefined) {
  if (status === 'ok') {
    return 'default' as const
  }
  if (status === 'error') {
    return 'destructive' as const
  }
  if (status === 'warning' || status === 'missing' || status === 'stale') {
    return 'outline' as const
  }
  return 'secondary' as const
}

function needsAttention(status: HealthStatus | undefined) {
  return status === 'warning' || status === 'missing' || status === 'stale' || status === 'error'
}

function ChecklistStatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'ok') {
    return <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
  }
  if (status === 'error') {
    return <AlertTriangle className="size-4 text-red-500" aria-hidden />
  }
  if (status === 'warning' || status === 'missing' || status === 'stale') {
    return <AlertTriangle className="size-4 text-amber-500" aria-hidden />
  }
  return <CircleHelp className="size-4 text-muted-foreground" aria-hidden />
}

export function RepoHealthSetup() {
  const [pat, setPat] = useState('')
  const [policy, setPolicy] = useState<PackagePolicy>('any-newer')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)
  const [repositories, setRepositories] = useState<RepositoryHealthCard[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState({
    connecting: false,
    loadingConnection: true,
    loadingRepositories: true,
    scanningAll: false,
    scanningSingle: '',
  })

  const connectionBadge = useMemo(() => {
    if (!connectionState) {
      return { text: 'loading', variant: 'secondary' as const }
    }
    if (connectionState.status === 'connected') {
      return { text: 'connected', variant: 'default' as const }
    }
    if (connectionState.status === 'rate-limited') {
      return { text: 'rate-limited', variant: 'outline' as const }
    }
    return { text: 'invalid', variant: 'destructive' as const }
  }, [connectionState])

  const filteredRepositories = useMemo(() => {
    if (filter === 'all') {
      return repositories
    }
    if (filter === 'healthy') {
      return repositories.filter((repository) => repository.lastScanStatus === 'ok')
    }
    return repositories.filter((repository) => needsAttention(repository.lastScanStatus))
  }, [filter, repositories])

  const filterCounts = useMemo(() => {
    const all = repositories.length
    const healthy = repositories.filter((repository) => repository.lastScanStatus === 'ok').length
    const needs = repositories.filter((repository) => needsAttention(repository.lastScanStatus)).length
    return { all, healthy, needs }
  }, [repositories])

  useEffect(() => {
    void loadConnection()
    void loadRepositories()
  }, [])

  async function loadConnection() {
    setLoadingState((prev) => ({ ...prev, loadingConnection: true }))
    const response = await fetch('/api/github-connection')
    const payload = (await response.json()) as ConnectionState | { error: string }
    if ('error' in payload) {
      setMessage(payload.error)
    } else {
      setConnectionState(payload)
      if (payload.packagePolicy) {
        setPolicy(payload.packagePolicy)
      }
    }
    setLoadingState((prev) => ({ ...prev, loadingConnection: false }))
  }

  async function loadRepositories() {
    setLoadingState((prev) => ({ ...prev, loadingRepositories: true }))
    setRepositoriesError(null)
    const response = await fetch('/api/scans')
    const payload = (await response.json()) as RepositoryHealthCard[] | { error: string }
    if ('error' in payload) {
      setRepositories([])
      setRepositoriesError(payload.error)
    } else {
      setRepositories(payload)
    }
    setLoadingState((prev) => ({ ...prev, loadingRepositories: false }))
  }

  async function connectWithPat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoadingState((prev) => ({ ...prev, connecting: true }))
    setMessage(null)

    const response = await fetch('/api/github-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pat,
        packagePolicy: policy,
      }),
    })

    const payload = (await response.json()) as
      | { ok: boolean; status: ConnectionStatus; error?: string }
      | { error: string }

    if ('error' in payload) {
      setMessage(payload.error)
    } else if (!payload.ok) {
      setMessage(payload.error ?? 'GitHub connection failed')
    } else {
      setPat('')
      setMessage('GitHub token connected successfully')
    }

    await loadConnection()
    await loadRepositories()
    setLoadingState((prev) => ({ ...prev, connecting: false }))
  }

  async function updatePolicy(nextPolicy: PackagePolicy) {
    setPolicy(nextPolicy)
    const response = await fetch('/api/github-connection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packagePolicy: nextPolicy }),
    })

    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload || !payload.ok) {
      setMessage('Failed to update package policy')
    }
    await loadConnection()
  }

  async function triggerScanAll() {
    setLoadingState((prev) => ({ ...prev, scanningAll: true }))
    setMessage(null)
    const response = await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'all' }),
    })
    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload || !payload.ok) {
      setMessage('Failed to trigger scan all')
    } else {
      setMessage('Scan all queued')
    }
    setLoadingState((prev) => ({ ...prev, scanningAll: false }))
  }

  async function triggerScanSingle(repositoryId: string) {
    setLoadingState((prev) => ({ ...prev, scanningSingle: repositoryId }))
    setMessage(null)
    const response = await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'single', repositoryId }),
    })
    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload || !payload.ok) {
      setMessage('Failed to trigger repository scan')
    } else {
      setMessage('Repository scan queued')
    }
    setLoadingState((prev) => ({ ...prev, scanningSingle: '' }))
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Repo Health Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Dependency freshness, checklist health, and repository scan controls.
          </p>
        </div>
        <Badge variant={connectionBadge.variant}>{connectionBadge.text}</Badge>
      </div>

      {message ? (
        <Card>
          <CardContent className="pt-6 text-sm">{message}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>GitHub connection</CardTitle>
          <CardDescription>Configure your PAT and package update policy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={connectWithPat} className="space-y-3">
            <Input
              type="password"
              placeholder="GitHub PAT (classic or fine-grained)"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              required
            />
            <div className="flex flex-wrap gap-2">
              {packagePolicyOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={policy === option.value ? 'default' : 'outline'}
                  onClick={() => void updatePolicy(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button type="submit" disabled={loadingState.connecting}>
              {loadingState.connecting ? 'Connecting…' : 'Connect GitHub'}
            </Button>
          </form>

          {loadingState.loadingConnection ? (
            <p className="text-sm text-muted-foreground">Loading connection…</p>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Current state: {connectionState?.status ?? 'unknown'}</p>
              {connectionState?.rateLimitResetAt ? (
                <p>
                  Rate limit resets: {new Date(connectionState.rateLimitResetAt).toLocaleString()}
                </p>
              ) : null}
              {connectionState?.lastValidatedAt ? (
                <p>Validated: {new Date(connectionState.lastValidatedAt).toLocaleString()}</p>
              ) : null}
              {connectionState?.lastError ? <p>Error: {connectionState.lastError}</p> : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard controls</CardTitle>
          <CardDescription>Filter repository health and trigger scans.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void triggerScanAll()} disabled={loadingState.scanningAll}>
            {loadingState.scanningAll ? 'Queueing scan…' : 'Scan all repositories'}
          </Button>
          <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            All ({filterCounts.all})
          </Button>
          <Button
            variant={filter === 'needs-attention' ? 'default' : 'outline'}
            onClick={() => setFilter('needs-attention')}
          >
            Needs attention ({filterCounts.needs})
          </Button>
          <Button
            variant={filter === 'healthy' ? 'default' : 'outline'}
            onClick={() => setFilter('healthy')}
          >
            Healthy ({filterCounts.healthy})
          </Button>
        </CardContent>
      </Card>

      {loadingState.loadingRepositories ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : repositoriesError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{repositoriesError}</CardContent>
        </Card>
      ) : filteredRepositories.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {repositories.length === 0
              ? 'No repositories found yet. Connect GitHub and run a scan.'
              : 'No repositories match the current filter.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRepositories.map((repository) => {
            const status = repository.lastScanStatus ?? 'unknown'
            const outdatedPackages = repository.packageFindings.filter((finding) => finding.status === 'warning')

            return (
              <Card key={repository._id}>
                <CardHeader>
                  <CardTitle className="text-base">{repository.fullName}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline">{repository.visibility}</Badge>
                    <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    <p>
                      Last scan:{' '}
                      {repository.lastScanAt
                        ? new Date(repository.lastScanAt).toLocaleString()
                        : 'Not scanned yet'}
                    </p>
                    <p>
                      Outdated packages:{' '}
                      <span className="font-medium text-foreground">{outdatedPackages.length}</span>
                    </p>
                  </div>

                  {outdatedPackages.length > 0 ? (
                    <div className="space-y-1 text-xs">
                      {outdatedPackages.slice(0, 5).map((finding) => (
                        <p key={finding._id} className="truncate">
                          {finding.packageName}: {finding.currentVersion} → {finding.latestVersion}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {repository.checklistFindings.map((finding) => (
                      <div key={finding._id} className="flex items-start gap-2 text-xs">
                        <ChecklistStatusIcon status={finding.status} />
                        <span>
                          <span className="font-medium">
                            {checklistLabels[finding.checkKey] ?? finding.checkKey}
                          </span>
                          {finding.detail ? ` — ${finding.detail}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {repository.lastScanError ? (
                    <p className="text-xs text-destructive">{repository.lastScanError}</p>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={() => void triggerScanSingle(repository._id)}
                    disabled={loadingState.scanningSingle === repository._id}
                  >
                    {loadingState.scanningSingle === repository._id ? 'Queueing…' : 'Scan repository'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
