export type HealthStatus = 'ok' | 'warning' | 'missing' | 'stale' | 'error' | 'unknown'
export type LatestCommitBuildStatus = 'passing' | 'failing'
export type LatestDeploymentStatus = 'deployed' | 'not-deployed'
export type ConnectionStatus = 'connected' | 'invalid' | 'rate-limited'
export type PackageManager = 'npm' | 'pnpm'
export type DashboardFilter = 'all' | 'needs-attention' | 'has-package-json' | PackageManager
export type SortOption = 'alphabetical' | 'created-desc' | 'updated-desc'

export type ConnectionState = {
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

export type PackageFinding = {
  _id: string
  packageName: string
  currentVersion: string
  latestVersion: string
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown'
  status: HealthStatus
}

export type ChecklistFinding = {
  _id: string
  checkKey: string
  status: HealthStatus
  detail?: string
}

export type RepositoryHealthCard = {
  _id: string
  _creationTime: number
  fullName: string
  htmlUrl: string
  defaultBranch: string
  primaryLanguage?: string
  hasPackageJson?: boolean
  packageManager?: PackageManager
  visibility: 'public' | 'private'
  githubCreatedAt?: number
  githubUpdatedAt?: number
  pushedAt?: number
  latestCommitSha?: string
  latestCommitUrl?: string
  latestCommitBuildStatus?: LatestCommitBuildStatus
  latestCommitBuildDetail?: string
  latestCommitBuildCheckedAt?: number
  latestDeploymentStatus?: LatestDeploymentStatus
  latestDeploymentEnvironment?: string
  latestDeploymentUrl?: string
  latestDeploymentDetail?: string
  latestDeploymentCheckedAt?: number
  lastScanAt?: number
  lastScanStatus?: HealthStatus
  lastScanError?: string
  packageFindings: PackageFinding[]
  checklistFindings: ChecklistFinding[]
}

export type SvglApiEntry = {
  title: string
  route: string | { light?: string; dark?: string }
}

export type StackLogo = {
  name: string
  iconUrl: string
}

export type ScanActivity = {
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

export const MAX_SCAN_SELECTION = 10

export const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'created-desc', label: 'Created date' },
  { value: 'updated-desc', label: 'Updated date' },
]

export const checklistLabels: Record<string, string> = {
  'tests-configured': 'Tests',
  'cicd-workflow': 'CI/CD',
  'readme-exists': 'README',
  'readme-freshness': 'README freshness',
  'dependabot-config': 'Dependabot',
  'security-advisories': 'Security alerts',
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

export function isOptionalChecklistFinding(checkKey: string) {
  return checkKey === 'dependabot-config'
}

export function needsAttention(status: HealthStatus | undefined) {
  return status === 'warning' || status === 'missing' || status === 'stale' || status === 'error'
}

export function hasRequiredChecklistAttention(repository: RepositoryHealthCard) {
  return (
    repository.latestCommitBuildStatus === 'failing' ||
    repository.latestDeploymentStatus === 'not-deployed' ||
    repository.checklistFindings.some(
      (finding) => !isOptionalChecklistFinding(finding.checkKey) && needsAttention(finding.status)
    )
  )
}

export function getEligiblePackageUpdates(repository: RepositoryHealthCard) {
  return repository.packageFindings.filter((finding) => finding.status === 'warning')
}

export function getRequiredChecklistFailures(repository: RepositoryHealthCard) {
  return repository.checklistFindings.filter(
    (finding) => !isOptionalChecklistFinding(finding.checkKey) && needsAttention(finding.status)
  )
}

export function isRepositoryHealthy(repository: RepositoryHealthCard) {
  return Boolean(repository.lastScanAt) && !hasRequiredChecklistAttention(repository)
}

export function getRepositoryDisplayName(fullName: string) {
  return fullName.split('/').at(-1) || fullName
}

export function getStackLogos(
  repository: RepositoryHealthCard,
  logoCatalog: Record<string, string>
): StackLogo[] {
  const candidates = new Set<string>()
  if (repository.primaryLanguage) {
    candidates.add(repository.primaryLanguage.toLowerCase())
  }
  for (const finding of repository.packageFindings) {
    candidates.add(finding.packageName.toLowerCase())
  }

  const logos: StackLogo[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const normalized = stackAlias[candidate] ?? candidate
    const route = logoCatalog[normalized]
    if (!route || seen.has(normalized)) {
      continue
    }
    logos.push({ name: normalized, iconUrl: route })
    seen.add(normalized)
    if (logos.length === 3) {
      break
    }
  }
  return logos
}

function toAbsoluteSvglRoute(route: string) {
  return route.startsWith('http')
    ? route
    : `https://svgl.app${route.startsWith('/') ? route : `/${route}`}`
}

export function normalizeSvglRoute(route: SvglApiEntry['route']) {
  if (typeof route === 'string') {
    return toAbsoluteSvglRoute(route)
  }
  const preferredRoute = route.dark ?? route.light
  return preferredRoute ? toAbsoluteSvglRoute(preferredRoute) : null
}
