'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ExclamationTriangleIcon,
  Link2Icon,
  MoonIcon,
  ReloadIcon,
  SunIcon,
  TrashIcon,
} from '@radix-ui/react-icons'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Filter,
  SlidersHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

type HealthStatus = 'ok' | 'warning' | 'missing' | 'stale' | 'error' | 'unknown'
type ConnectionStatus = 'connected' | 'invalid' | 'rate-limited'
type DashboardFilter = 'all' | 'needs-attention' | 'has-package-json'
type SortOption = 'alphabetical' | 'created-desc' | 'updated-desc'

type ConnectionState = {
  status: ConnectionStatus
  connected: boolean
  rateLimitResetAt?: number
  lastValidatedAt?: number
  lastError?: string
  accountLogin?: string
  accountName?: string
  accountAvatarUrl?: string
  accountHtmlUrl?: string
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
  _creationTime: number
  fullName: string
  htmlUrl: string
  primaryLanguage?: string
  hasPackageJson?: boolean
  visibility: 'public' | 'private'
  githubCreatedAt?: number
  githubUpdatedAt?: number
  pushedAt?: number
  lastScanAt?: number
  lastScanStatus?: HealthStatus
  lastScanError?: string
  packageFindings: PackageFinding[]
  checklistFindings: ChecklistFinding[]
}

type SvglApiEntry = {
  title: string
  route: string | { light?: string; dark?: string }
}

type StackLogo = {
  name: string
  iconUrl: string
}

type ScanActivity = {
  mode: 'all' | 'single'
  status: 'running' | 'completed' | 'timed-out'
  startedAt: number
  lastCheckedAt?: number
  repositoryId?: string
  repositoryName?: string
  currentRepositoryName?: string
  selectedRepositoryIds?: string[]
  processedCount?: number
  totalCount?: number
}

const MAX_SCAN_SELECTION = 10

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'created-desc', label: 'Created date' },
  { value: 'updated-desc', label: 'Updated date' },
]

const checklistLabels: Record<string, string> = {
  'tests-configured': 'Tests',
  'cicd-workflow': 'CI/CD',
  'readme-exists': 'README',
  'readme-freshness': 'README freshness',
  'dependabot-config': 'Dependabot',
}

const stackAlias: Record<string, string> = {
  next: 'next.js',
  react: 'react',
  typescript: 'typescript',
  javascript: 'javascript',
  tailwindcss: 'tailwind css',
  vite: 'vite',
  vitest: 'vitest',
  convex: 'convex',
  prisma: 'prisma',
  docker: 'docker',
  eslint: 'eslint',
  jest: 'jest',
  node: 'node.js',
  'node.js': 'node.js',
  'c#': 'c#',
  'c++': 'c++',
  'objective-c': 'objective-c',
  'objective-c++': 'objective-c++',
  go: 'go',
  rust: 'rust',
  python: 'python',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  php: 'php',
  ruby: 'ruby',
  'jupyter notebook': 'jupyter',
  html: 'html5',
  css: 'css',
  scss: 'sass',
  vue: 'vue.js',
  svelte: 'svelte',
  angular: 'angular',
  'c sharp': 'c#',
  cpp: 'c++',
  express: 'express',
  mongodb: 'mongodb',
  postgres: 'postgresql',
  mysql: 'mysql',
  redis: 'redis',
  aws: 'amazon web services',
  'aws-sdk': 'amazon web services',
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

function toAbsoluteSvglRoute(route: string) {
  return route.startsWith('http')
    ? route
    : `https://svgl.app${route.startsWith('/') ? route : `/${route}`}`
}

function normalizeSvglRoute(route: SvglApiEntry['route']) {
  if (typeof route === 'string') {
    return toAbsoluteSvglRoute(route)
  }
  if (route.dark) {
    return toAbsoluteSvglRoute(route.dark)
  }
  if (route.light) {
    return toAbsoluteSvglRoute(route.light)
  }
  return null
}

export function RepoHealthSetup() {
  const currentYear = new Date().getFullYear()
  const [pat, setPat] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    const storedTheme = window.localStorage.getItem('theme')
    const systemPrefersDark =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false

    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme
    }

    return systemPrefersDark ? 'dark' : 'light'
  })
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc')
  const [minimumYear, setMinimumYear] = useState<number>(() => new Date().getFullYear() - 2)
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)
  const [repositories, setRepositories] = useState<RepositoryHealthCard[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null)
  const [detailRepository, setDetailRepository] = useState<RepositoryHealthCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scanActivity, setScanActivity] = useState<ScanActivity | null>(null)
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>([])
  const [svglMap, setSvglMap] = useState<Record<string, string>>({})
  const [loadingState, setLoadingState] = useState({
    connecting: false,
    deletingConnection: false,
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
    const fromTimestamp = new Date(minimumYear, 0, 1).getTime()
    const repositoriesWithinYear = repositories.filter((repository) => {
      const createdAt = repository.githubCreatedAt ?? 0
      const updatedAt =
        repository.githubUpdatedAt ?? repository.pushedAt ?? repository.lastScanAt ?? 0
      const latestTimestamp = Math.max(createdAt, updatedAt)

      if (latestTimestamp === 0) {
        return true
      }

      return latestTimestamp >= fromTimestamp
    })

    if (filter === 'needs-attention') {
      return repositoriesWithinYear.filter((repository) =>
        needsAttention(repository.lastScanStatus)
      )
    }
    if (filter === 'has-package-json') {
      return repositoriesWithinYear.filter((repository) => repository.hasPackageJson === true)
    }
    return repositoriesWithinYear
  }, [filter, minimumYear, repositories])

  const sortedRepositories = useMemo(() => {
    const list = [...filteredRepositories]
    if (sortBy === 'alphabetical') {
      return list.sort((a, b) => a.fullName.localeCompare(b.fullName))
    }
    if (sortBy === 'created-desc') {
      return list.sort((a, b) => {
        const aCreated = a.githubCreatedAt ?? a._creationTime
        const bCreated = b.githubCreatedAt ?? b._creationTime
        return bCreated - aCreated
      })
    }
    return list.sort((a, b) => {
      const aUpdated = a.githubUpdatedAt ?? a.pushedAt ?? a.lastScanAt ?? 0
      const bUpdated = b.githubUpdatedAt ?? b.pushedAt ?? b.lastScanAt ?? 0
      return bUpdated - aUpdated
    })
  }, [filteredRepositories, sortBy])

  const lastUpdatedSortedRepositories = useMemo(() => {
    return [...repositories].sort((a, b) => {
      const aUpdated = a.githubUpdatedAt ?? a.pushedAt ?? a.lastScanAt ?? 0
      const bUpdated = b.githubUpdatedAt ?? b.pushedAt ?? b.lastScanAt ?? 0
      return bUpdated - aUpdated
    })
  }, [repositories])

  const filterCounts = useMemo(() => {
    const all = repositories.length
    const needs = repositories.filter((repository) =>
      needsAttention(repository.lastScanStatus)
    ).length
    const hasPackageJson = repositories.filter(
      (repository) => repository.hasPackageJson === true
    ).length
    return { all, needs, hasPackageJson }
  }, [repositories])

  const lastScanAllRunAt = useMemo(() => {
    const latest = repositories.reduce<number>(
      (maxTimestamp, repository) => Math.max(maxTimestamp, repository.lastScanAt ?? 0),
      0
    )
    return latest > 0 ? latest : null
  }, [repositories])

  const oldestCreatedYear = useMemo(() => {
    if (repositories.length === 0) {
      return currentYear - 2
    }

    let oldestTimestamp = Number.POSITIVE_INFINITY
    for (const repository of repositories) {
      const createdAt = repository.githubCreatedAt ?? repository._creationTime
      oldestTimestamp = Math.min(oldestTimestamp, createdAt)
    }

    if (!Number.isFinite(oldestTimestamp)) {
      return currentYear - 2
    }

    return new Date(oldestTimestamp).getFullYear()
  }, [currentYear, repositories])

  useEffect(() => {
    void loadConnection()
    void loadRepositories()
    void loadSvglCatalog()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    window.localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  async function loadSvglCatalog() {
    try {
      const response = await fetch('https://api.svgl.app?limit=1500')
      if (!response.ok) {
        return
      }
      const payload = (await response.json()) as SvglApiEntry[]
      const entries: Record<string, string> = {}
      for (const item of payload) {
        const normalizedRoute = normalizeSvglRoute(item.route)
        if (!normalizedRoute) {
          continue
        }
        entries[item.title.toLowerCase()] = normalizedRoute
      }
      setSvglMap(entries)
    } catch {
      // Ignore external logo API errors and keep dashboard functional.
    }
  }

  async function loadConnection() {
    setLoadingState((prev) => ({ ...prev, loadingConnection: true }))
    const response = await fetch('/api/github-connection')
    const payload = (await response.json()) as ConnectionState | { error: string }
    if ('error' in payload) {
      setMessage(payload.error ?? 'GitHub connection failed')
    } else {
      setConnectionState(payload)

      const isMissingAccountProfile =
        payload.connected &&
        !payload.accountLogin &&
        !payload.accountName &&
        !payload.accountAvatarUrl &&
        !payload.accountHtmlUrl

      if (isMissingAccountProfile) {
        const refreshResponse = await fetch('/api/github-connection', { method: 'PUT' })
        const refreshedPayload = (await refreshResponse.json()) as
          | ConnectionState
          | { error: string }
        if (!('error' in refreshedPayload)) {
          setConnectionState(refreshedPayload)
        }
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
      setSelectedRepositoryIds([])
    } else {
      setRepositories(payload)
      setSelectedRepositoryIds((previous) => {
        const existingIds = new Set(payload.map((repository) => repository._id))
        const filteredPrevious = previous.filter((repositoryId) => existingIds.has(repositoryId))
        return filteredPrevious.slice(0, MAX_SCAN_SELECTION)
      })
    }
    setLoadingState((prev) => ({ ...prev, loadingRepositories: false }))
  }

  async function pollQueuedScans(targetRepositoryId?: string, repositoryIds?: string[]) {
    const pollStartedAt = Date.now()
    let attempts = 0
    const maxAttempts = 120
    const isSingleScan = Boolean(targetRepositoryId)
    const selectedSet = new Set(repositoryIds ?? [])
    const selectedIds = repositoryIds?.slice(0, MAX_SCAN_SELECTION) ?? []

    const pollOnce = async (interval?: ReturnType<typeof setInterval>) => {
      attempts += 1
      try {
        const response = await fetch(
          isSingleScan ? `/api/scans?repositoryId=${targetRepositoryId}` : '/api/scans'
        )
        const payload = (await response.json()) as RepositoryHealthCard[] | { error: string }
        if ('error' in payload) {
          return
        }

        if (isSingleScan && targetRepositoryId) {
          setRepositories((prev) => {
            const updated = payload.find((repo) => repo._id === targetRepositoryId)
            if (!updated) {
              return prev
            }
            return prev.map((repo) => (repo._id === targetRepositoryId ? updated : repo))
          })
        } else {
          setRepositories(payload)
        }

        setScanActivity((prev) =>
          prev
            ? {
                ...prev,
                lastCheckedAt: Date.now(),
              }
            : prev
        )

        const processedCount = isSingleScan
          ? payload.some(
              (repo) => repo._id === targetRepositoryId && (repo.lastScanAt ?? 0) >= pollStartedAt
            )
            ? 1
            : 0
          : payload.filter(
              (repo) => selectedSet.has(repo._id) && (repo.lastScanAt ?? 0) >= pollStartedAt
            ).length

        let currentRepositoryName: string | undefined
        if (isSingleScan) {
          const targetRepository = payload.find((repo) => repo._id === targetRepositoryId)
          currentRepositoryName = targetRepository
            ? getRepositoryDisplayName(targetRepository.fullName)
            : undefined
        } else {
          const nextRepositoryId = selectedIds.find(
            (selectedId) =>
              !payload.some(
                (repo) => repo._id === selectedId && (repo.lastScanAt ?? 0) >= pollStartedAt
              )
          )
          if (nextRepositoryId) {
            const nextRepository = payload.find((repo) => repo._id === nextRepositoryId)
            currentRepositoryName = nextRepository
              ? getRepositoryDisplayName(nextRepository.fullName)
              : undefined
          }
        }

        setScanActivity((prev) =>
          prev
            ? {
                ...prev,
                processedCount,
                currentRepositoryName,
              }
            : prev
        )

        const hasCompleted = isSingleScan
          ? processedCount === 1
          : processedCount >= Math.min(repositoryIds?.length ?? 0, MAX_SCAN_SELECTION)

        if (hasCompleted || attempts >= maxAttempts) {
          if (interval) {
            clearInterval(interval)
          }
          setScanActivity((prev) =>
            prev
              ? {
                  ...prev,
                  status: hasCompleted ? 'completed' : 'timed-out',
                  lastCheckedAt: Date.now(),
                }
              : prev
          )
          setMessage(
            hasCompleted
              ? `Scan finished at ${new Date().toLocaleTimeString()} and dashboard updated.`
              : 'Scan is still running. We stopped auto-checking; use Scan again or refresh later.'
          )
        }
      } catch {
        if (attempts >= maxAttempts) {
          if (interval) {
            clearInterval(interval)
          }
          setScanActivity((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'timed-out',
                  lastCheckedAt: Date.now(),
                }
              : prev
          )
        }
      }
    }

    await pollOnce()
    const interval = setInterval(() => {
      void pollOnce(interval)
    }, 3500)
  }

  function selectLastTenRepositories() {
    const nextIds = lastUpdatedSortedRepositories
      .slice(0, MAX_SCAN_SELECTION)
      .map((repository) => repository._id)
    setSelectedRepositoryIds(nextIds)
    setMessage(
      nextIds.length > 0
        ? `Selected last ${nextIds.length} repositories for Scan all.`
        : 'No repositories available to select.'
    )
  }

  function unselectAllRepositories() {
    setSelectedRepositoryIds([])
    setMessage('Cleared selected repositories.')
  }

  function toggleRepositorySelection(repositoryId: string, isChecked: boolean) {
    setSelectedRepositoryIds((previous) => {
      if (!isChecked) {
        return previous.filter((id) => id !== repositoryId)
      }

      if (previous.includes(repositoryId)) {
        return previous
      }

      if (previous.length >= MAX_SCAN_SELECTION) {
        setMessage('You can select at most 10 repositories per Scan all run.')
        return previous
      }

      return [...previous, repositoryId]
    })
  }

  async function connectWithPat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoadingState((prev) => ({ ...prev, connecting: true }))
    setMessage(null)

    const response = await fetch('/api/github-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pat }),
    })

    const payload = (await response.json()) as
      | { ok: boolean; status: ConnectionStatus; error?: string }
      | { error: string }

    if ('error' in payload) {
      setMessage(payload.error ?? 'GitHub connection failed')
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

  async function triggerScanAll() {
    const selectedForScan = selectedRepositoryIds.slice(0, MAX_SCAN_SELECTION)
    if (selectedForScan.length === 0) {
      setMessage('Select up to 10 repositories before running Scan all.')
      return
    }

    setLoadingState((prev) => ({ ...prev, scanningAll: true }))
    setMessage(null)
    const response = await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'all', repositoryIds: selectedForScan }),
    })
    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload || !payload.ok) {
      setMessage('Failed to trigger scan all for selected repositories')
    } else {
      const firstSelectedRepository = repositories.find(
        (repository) => repository._id === selectedForScan[0]
      )
      const firstSelectedName = firstSelectedRepository
        ? getRepositoryDisplayName(firstSelectedRepository.fullName)
        : 'selected repositories'
      setMessage(`Scan all queued for ${selectedForScan.length} repositories. Watching updates...`)
      setScanActivity({
        mode: 'all',
        status: 'running',
        startedAt: Date.now(),
        selectedRepositoryIds: selectedForScan,
        processedCount: 0,
        totalCount: selectedForScan.length,
        currentRepositoryName: firstSelectedName,
      })
      void pollQueuedScans(undefined, selectedForScan)
    }
    setLoadingState((prev) => ({ ...prev, scanningAll: false }))
  }

  async function triggerScanSingle(repositoryId: string) {
    setLoadingState((prev) => ({ ...prev, scanningSingle: repositoryId }))
    setMessage(null)
    const targetRepository = repositories.find((repository) => repository._id === repositoryId)
    const repositoryName = targetRepository
      ? getRepositoryDisplayName(targetRepository.fullName)
      : 'selected repository'
    const response = await fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'single', repositoryId }),
    })
    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload) {
      setMessage(payload.error ?? 'Failed to trigger repository scan')
    } else if (!payload.ok) {
      setMessage(payload.message ?? 'Failed to trigger repository scan')
    } else {
      setMessage(`Repository scan started for ${repositoryName}. Watching updates...`)
      setScanActivity({
        mode: 'single',
        status: 'running',
        startedAt: Date.now(),
        repositoryId,
        repositoryName,
        currentRepositoryName: repositoryName,
        processedCount: 0,
        totalCount: 1,
      })
      void pollQueuedScans(repositoryId)
    }
    setLoadingState((prev) => ({ ...prev, scanningSingle: '' }))
  }

  async function deletePatConnection() {
    setLoadingState((prev) => ({ ...prev, deletingConnection: true }))
    setMessage(null)

    const response = await fetch('/api/github-connection', {
      method: 'DELETE',
    })

    const payload = (await response.json()) as { ok: boolean; message?: string } | { error: string }
    if ('error' in payload || !payload.ok) {
      setMessage('Failed to delete GitHub connection')
    } else {
      setPat('')
      setConnectionState(null)
      setMessage('GitHub token removed')
      setDeleteDialogOpen(false)
      await loadConnection()
      await loadRepositories()
    }

    setLoadingState((prev) => ({ ...prev, deletingConnection: false }))
  }

  function findStackLogos(repository: RepositoryHealthCard): StackLogo[] {
    const seen = new Set<string>()
    const logos: StackLogo[] = []

    const language = repository.primaryLanguage?.toLowerCase().trim()
    if (language) {
      const normalizedLanguage = stackAlias[language] ?? language
      const languageLogo = svglMap[normalizedLanguage]
      if (languageLogo) {
        logos.push({ name: normalizedLanguage, iconUrl: languageLogo })
        seen.add(normalizedLanguage)
      }
    }

    for (const finding of repository.packageFindings) {
      const pkg = finding.packageName.toLowerCase()
      const normalized = stackAlias[pkg] ?? pkg
      if (seen.has(normalized)) {
        continue
      }

      const route = svglMap[normalized]
      if (!route) {
        continue
      }

      logos.push({ name: normalized, iconUrl: route })
      seen.add(normalized)
      if (logos.length >= 4) {
        break
      }
    }

    return logos
  }

  function getRepositoryDisplayName(fullName: string) {
    const parts = fullName.split('/')
    return parts[parts.length - 1] ?? fullName
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-8xl flex-1 flex-col gap-5 px-6 py-7 sm:px-3 lg:px-4">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-linear-to-br from-card via-card to-muted/20 px-5 py-4 shadow-sm">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl leading-tight tracking-tight">
              Repo Health Monitor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dependency freshness, checklist health, and repository scan controls.
            </p>
            {connectionState?.connected ? (
              <div className="mt-3 flex items-center gap-3">
                {connectionState.accountAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connectionState.accountAvatarUrl}
                    alt="GitHub avatar"
                    className="size-9 rounded-full border border-border/70 object-cover"
                  />
                ) : (
                  <div className="size-9 rounded-full border border-border/70 bg-muted" />
                )}
                <div className="min-w-0">
                  {connectionState.accountHtmlUrl ? (
                    <a
                      href={connectionState.accountHtmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {connectionState.accountName ??
                        connectionState.accountLogin ??
                        'Unknown account'}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-semibold text-foreground">
                      {connectionState.accountName ??
                        connectionState.accountLogin ??
                        'Unknown account'}
                    </p>
                  )}
                  {connectionState.accountLogin ? (
                    <p className="text-xs text-muted-foreground">@{connectionState.accountLogin}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 rounded-full"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </Button>
              <Badge variant={connectionBadge.variant} className="rounded-full px-3 py-1 text-xs">
                {connectionBadge.text}
              </Badge>
            </div>
            <a
              href="/manual"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-full border border-border/70 bg-background px-4 text-xs font-medium text-foreground shadow-xs hover:bg-muted"
            >
              How scan works →
            </a>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-sm text-foreground">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-3 border-border/60 bg-linear-to-br from-card to-muted/20 py-4 shadow-sm">
            <CardHeader className="gap-1 px-5">
              <CardTitle className="text-lg">GitHub connection</CardTitle>
              <CardDescription>Configure your PAT connection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-1">
              <form onSubmit={connectWithPat} className="space-y-2.5">
                {!connectionState?.connected ? (
                  <>
                    <Input
                      type="password"
                      placeholder="GitHub PAT (classic or fine-grained)"
                      value={pat}
                      onChange={(event) => setPat(event.target.value)}
                      required
                      className="h-10 rounded-xl"
                    />
                    <Button
                      type="submit"
                      disabled={loadingState.connecting}
                      className="h-9 rounded-full px-5"
                    >
                      {loadingState.connecting ? 'Connecting...' : 'Connect GitHub'}
                    </Button>
                  </>
                ) : (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full px-5"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={loadingState.deletingConnection}
                    >
                      <TrashIcon />
                      Delete token
                    </Button>
                  </div>
                )}
              </form>

              {loadingState.loadingConnection ? (
                <p className="text-sm text-muted-foreground">Loading connection...</p>
              ) : (
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <p>Current state: {connectionState?.status ?? 'unknown'}</p>
                  {connectionState?.rateLimitResetAt ? (
                    <p>
                      Rate limit resets:{' '}
                      {new Date(connectionState.rateLimitResetAt).toLocaleString()}
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

          <Card className="gap-3 border-border/60 bg-linear-to-br from-card via-card to-muted/30 py-4 shadow-sm">
            <CardHeader className="gap-1 px-5 pb-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
                Dashboard controls
              </CardTitle>
              <CardDescription>Run scans and track progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="w-full rounded-full border border-border/70 bg-background/90 px-3 py-1 font-medium sm:w-auto">
                  Selected: {selectedRepositoryIds.length}/{MAX_SCAN_SELECTION}
                </span>
                <span className="w-full rounded-full border border-border/70 bg-background/90 px-3 py-1 font-medium sm:w-auto">
                  Last run:{' '}
                  {lastScanAllRunAt ? new Date(lastScanAllRunAt).toLocaleString() : 'Never'}
                </span>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/75 p-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Activity className="size-3.5" aria-hidden />
                  Scan actions
                </p>
                <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void triggerScanAll()}
                    disabled={loadingState.scanningAll || selectedRepositoryIds.length === 0}
                    className="h-8 w-full rounded-full px-4 text-xs sm:w-auto"
                  >
                    {loadingState.scanningAll ? 'Queueing...' : 'Scan selected'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full rounded-full px-4 text-xs sm:w-auto"
                    onClick={selectLastTenRepositories}
                    disabled={repositories.length === 0}
                  >
                    Select last 10
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full rounded-full px-4 text-xs sm:w-auto"
                    onClick={unselectAllRepositories}
                    disabled={selectedRepositoryIds.length === 0}
                  >
                    Unselect all
                  </Button>
                </div>
              </div>

              {scanActivity ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Scan status:</span>{' '}
                  {scanActivity.status === 'running'
                    ? scanActivity.mode === 'all'
                      ? `running · currently processing ${scanActivity.processedCount ?? 0}/${scanActivity.totalCount ?? MAX_SCAN_SELECTION} · now scanning ${scanActivity.currentRepositoryName ?? 'selected repositories'}`
                      : `running · ${scanActivity.currentRepositoryName ?? scanActivity.repositoryName ?? 'selected repository'} (${scanActivity.processedCount ?? 0}/${scanActivity.totalCount ?? 1})`
                    : scanActivity.status === 'completed'
                      ? 'completed'
                      : 'timed out'}
                  {scanActivity.lastCheckedAt
                    ? ` · last checked ${new Date(scanActivity.lastCheckedAt).toLocaleTimeString()}`
                    : ''}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border border-border/60 bg-linear-to-r from-card via-card to-muted/25 p-3 shadow-sm">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Filter className="size-4 text-muted-foreground" aria-hidden />
                  Repository filters
                </p>
                <p className="text-xs text-muted-foreground">
                  Choose which repositories to show in the card grid.
                </p>
              </div>
              <div className="grid w-full gap-1.5 rounded-2xl border border-border/60 bg-background/90 p-1.5 sm:inline-flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
                <Button
                  size="sm"
                  className="h-8 w-full rounded-full px-3 text-xs sm:h-7 sm:w-auto"
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setFilter('all')}
                >
                  All ({filterCounts.all})
                </Button>
                <Button
                  size="sm"
                  className="h-8 w-full rounded-full px-3 text-xs sm:h-7 sm:w-auto"
                  variant={filter === 'has-package-json' ? 'default' : 'ghost'}
                  onClick={() => setFilter('has-package-json')}
                >
                  Has package.json ({filterCounts.hasPackageJson})
                </Button>
                <Button
                  size="sm"
                  className="h-8 w-full rounded-full px-3 text-xs sm:h-7 sm:w-auto"
                  variant={filter === 'needs-attention' ? 'default' : 'ghost'}
                  onClick={() => setFilter('needs-attention')}
                >
                  Needs attention ({filterCounts.needs})
                </Button>

                <div className="h-px w-full bg-border/50 sm:hidden" />

                <div className="grid w-full gap-1.5 sm:w-auto sm:grid-cols-[auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-1">
                    Sort by
                  </span>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger className="h-8 w-full rounded-full text-xs sm:w-40" size="sm">
                      <SelectValue placeholder="Select sorting" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid w-full gap-1.5 sm:w-auto sm:grid-cols-[auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-1">
                    From year
                  </span>
                  <Select
                    value={String(minimumYear)}
                    onValueChange={(value) => setMinimumYear(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-full rounded-full text-xs sm:w-28" size="sm">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: Math.max(1, currentYear - oldestCreatedYear + 1) },
                        (_, index) => currentYear - index
                      ).map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loadingState.loadingRepositories ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="h-full">
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
        ) : sortedRepositories.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {repositories.length === 0
                ? 'No repositories found yet. Connect GitHub and run a scan.'
                : 'No repositories match the current filter.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {sortedRepositories.map((repository) => {
              const outdatedPackages = repository.packageFindings.filter(
                (finding) => finding.status === 'warning'
              )
              const failedChecklist = repository.checklistFindings.filter((finding) =>
                needsAttention(finding.status)
              )
              const isPerfect =
                repository.lastScanAt &&
                outdatedPackages.length === 0 &&
                failedChecklist.length === 0
              const stackLogos = findStackLogos(repository)

              return (
                <Card key={repository._id} className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <label className="mr-1 inline-flex items-center" title="Select repository">
                        <input
                          type="checkbox"
                          checked={selectedRepositoryIds.includes(repository._id)}
                          onChange={(event) =>
                            toggleRepositorySelection(repository._id, event.target.checked)
                          }
                          disabled={
                            !selectedRepositoryIds.includes(repository._id) &&
                            selectedRepositoryIds.length >= MAX_SCAN_SELECTION
                          }
                          aria-label={`Select ${repository.fullName}`}
                          className="size-4 cursor-pointer rounded border border-border"
                        />
                      </label>
                      <span className="line-clamp-1">
                        {getRepositoryDisplayName(repository.fullName)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        asChild
                        aria-label="Open GitHub repository"
                        title="Open GitHub repository"
                      >
                        <a href={repository.htmlUrl} target="_blank" rel="noreferrer">
                          <Link2Icon />
                        </a>
                      </Button>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{repository.visibility}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex h-full flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex min-h-8 items-center gap-2">
                        {stackLogos.length > 0 ? (
                          stackLogos.map((logo) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${repository._id}-${logo.name}`}
                              src={logo.iconUrl}
                              alt={logo.name}
                              title={logo.name}
                              className="size-5"
                            />
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No stack logos detected
                          </span>
                        )}
                      </div>

                      <div className="grid gap-1 text-xs text-muted-foreground">
                        {repository.hasPackageJson === false ? (
                          <p>No package.json found</p>
                        ) : (
                          <p>
                            Outdated packages:{' '}
                            <span className="font-semibold text-foreground">
                              {outdatedPackages.length}
                            </span>
                          </p>
                        )}
                        <p>
                          Checklist warnings:{' '}
                          <span className="font-semibold text-foreground">
                            {failedChecklist.length}
                          </span>
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          Created{' '}
                          {new Date(
                            repository.githubCreatedAt ?? repository._creationTime
                          ).toLocaleDateString()}
                          {' · '}Updated{' '}
                          {new Date(
                            repository.githubUpdatedAt ??
                              repository.pushedAt ??
                              repository.lastScanAt ??
                              repository._creationTime
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className={`size-8 ${
                            isPerfect
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-amber-600 hover:bg-amber-50'
                          }`}
                          onClick={() => {
                            setDetailRepository(repository)
                            setDetailOpen(true)
                          }}
                          aria-label={isPerfect ? 'Open details (All good)' : 'Open details'}
                          title={isPerfect ? 'Everything looks good' : 'Warnings and details'}
                        >
                          {isPerfect ? (
                            <CheckCircle2 className="size-4" />
                          ) : (
                            <ExclamationTriangleIcon />
                          )}
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Last scan:{' '}
                          {repository.lastScanAt
                            ? new Date(repository.lastScanAt).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => void triggerScanSingle(repository._id)}
                        disabled={loadingState.scanningSingle === repository._id}
                        aria-label="Scan repository"
                        title="Scan repository"
                      >
                        <ReloadIcon
                          className={
                            loadingState.scanningSingle === repository._id ? 'animate-spin' : ''
                          }
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailRepository?.fullName ?? 'Repository details'}</DialogTitle>
            <DialogDescription>Package update findings and checklist details.</DialogDescription>
          </DialogHeader>

          {detailRepository ? (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="mb-2 font-semibold">Package updates</h3>
                {detailRepository.packageFindings.filter((finding) => finding.status === 'warning')
                  .length === 0 ? (
                  <p className="text-muted-foreground">No package updates needed.</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-auto rounded-md border border-border/60 p-3 text-xs">
                    {detailRepository.packageFindings
                      .filter((finding) => finding.status === 'warning')
                      .map((finding) => (
                        <p key={finding._id}>
                          <span className="font-medium">{finding.packageName}</span>:{' '}
                          {finding.currentVersion}
                          {' -> '}
                          {finding.latestVersion} ({finding.status})
                        </p>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Checklist</h3>
                {detailRepository.checklistFindings.length === 0 ? (
                  <p className="text-muted-foreground">No checklist findings available.</p>
                ) : (
                  <div className="space-y-2">
                    {detailRepository.checklistFindings.map((finding) => (
                      <div key={finding._id} className="flex items-start gap-2 text-xs">
                        <ChecklistStatusIcon status={finding.status} />
                        <span>
                          <span className="font-medium">
                            {checklistLabels[finding.checkKey] ?? finding.checkKey}
                          </span>
                          {finding.detail ? ` - ${finding.detail}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detailRepository.lastScanError ? (
                <p className="text-xs text-destructive">
                  Last scan error: {detailRepository.lastScanError}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete GitHub token?</DialogTitle>
            <DialogDescription>
              This removes the saved PAT and disconnects the dashboard from GitHub.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={loadingState.deletingConnection}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deletePatConnection()}
              disabled={loadingState.deletingConnection}
            >
              {loadingState.deletingConnection ? 'Deleting...' : 'Delete token'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
