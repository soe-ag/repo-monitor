'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type PackagePolicy = 'any-newer' | 'minor-or-major' | 'major-only'
type ConnectionStatus = 'connected' | 'invalid' | 'rate-limited'

type ConnectionState = {
  status: ConnectionStatus
  connected: boolean
  packagePolicy?: PackagePolicy
  rateLimitResetAt?: number
  lastValidatedAt?: number
  lastError?: string
}

type RepositorySummary = {
  _id: string
  fullName: string
  visibility: 'public' | 'private'
  lastScanStatus?: 'ok' | 'warning' | 'missing' | 'stale' | 'error' | 'unknown'
}

const packagePolicyOptions: Array<{ value: PackagePolicy; label: string }> = [
  { value: 'any-newer', label: 'Flag any newer package version' },
  { value: 'minor-or-major', label: 'Flag minor/major updates only' },
  { value: 'major-only', label: 'Flag major updates only' },
]

export function RepoHealthSetup() {
  const [pat, setPat] = useState('')
  const [policy, setPolicy] = useState<PackagePolicy>('any-newer')
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)
  const [repositories, setRepositories] = useState<RepositorySummary[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState({
    connecting: false,
    loadingConnection: true,
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
    const response = await fetch('/api/scans')
    const payload = (await response.json()) as RepositorySummary[] | { error: string }
    if ('error' in payload) {
      setMessage(payload.error)
      return
    }
    setRepositories(payload)
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Repo Health Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 + 2 foundation: PAT connection, Convex storage, scans, and schedules.
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
          <CardDescription>
            Connect with a PAT, validate it against GitHub, and store connection state in Convex.
          </CardDescription>
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
          <CardTitle>Scan controls</CardTitle>
          <CardDescription>
            Trigger manual scans while weekly scans run through Convex cron.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void triggerScanAll()} disabled={loadingState.scanningAll}>
            {loadingState.scanningAll ? 'Queueing scan…' : 'Scan all repositories'}
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            {repositories.map((repository) => (
              <Card key={repository._id}>
                <CardHeader>
                  <CardTitle className="text-base">{repository.fullName}</CardTitle>
                  <CardDescription>{repository.visibility}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{repository.lastScanStatus ?? 'unknown'}</Badge>
                  <Button
                    variant="outline"
                    onClick={() => void triggerScanSingle(repository._id)}
                    disabled={loadingState.scanningSingle === repository._id}
                  >
                    {loadingState.scanningSingle === repository._id ? 'Queueing…' : 'Scan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
