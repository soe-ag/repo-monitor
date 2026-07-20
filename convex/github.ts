import {
  DEFAULT_PACKAGE_POLICY,
  PACKAGE_UPDATE_MINIMUM_AGE_MS,
  type PackagePolicy,
} from './constants'

const GITHUB_API_BASE = 'https://api.github.com'
const NPM_REGISTRY_BASE = 'https://registry.npmjs.org'

type FetchJsonOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  token: string
  body?: string
}

export type LatestCommitBuildStatus = 'passing' | 'failing'
export type LatestDeploymentStatus = 'deployed' | 'not-deployed'

type GitHubCheckRun = {
  status: string
  conclusion?: string | null
}

type GitHubCommitStatus = {
  state?: string
}

export type GitHubDeployment = {
  id: number
  environment?: string | null
  created_at?: string
  transient_environment?: boolean
}

export type GitHubDeploymentStatus = {
  state?: string
  description?: string | null
  environment?: string | null
  environment_url?: string | null
  target_url?: string | null
  log_url?: string | null
  created_at?: string
}

type DeploymentWithStatus = {
  deployment: GitHubDeployment
  latestStatus?: GitHubDeploymentStatus
}

export class GitHubHttpError extends Error {
  status: number
  rateLimitResetAt: number | null

  constructor(message: string, status: number, rateLimitResetAt: number | null) {
    super(message)
    this.status = status
    this.rateLimitResetAt = rateLimitResetAt
  }
}

export async function fetchGitHubJson<T>(path: string, options: FetchJsonOptions): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.token}`,
      'User-Agent': 'repo-monitor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    const resetHeader = response.headers.get('x-ratelimit-reset')
    const rateLimitResetAt = resetHeader ? Number(resetHeader) * 1000 : null
    throw new GitHubHttpError(
      `GitHub API request failed: ${response.status}`,
      response.status,
      Number.isFinite(rateLimitResetAt) ? rateLimitResetAt : null
    )
  }

  return (await response.json()) as T
}

export function summarizeLatestCommitBuild(
  checkRuns: GitHubCheckRun[],
  commitStatus?: GitHubCommitStatus
): { status: LatestCommitBuildStatus; detail: string } | null {
  if (
    commitStatus?.state === 'pending' ||
    checkRuns.some((checkRun) => checkRun.status !== 'completed')
  ) {
    return null
  }

  if (commitStatus?.state === 'failure' || commitStatus?.state === 'error') {
    return {
      status: 'failing',
      detail: `GitHub commit status is ${commitStatus.state}`,
    }
  }

  const failedCount = checkRuns.filter(
    (checkRun) => !['success', 'neutral', 'skipped'].includes(checkRun.conclusion ?? 'unknown')
  ).length
  if (failedCount > 0) {
    return {
      status: 'failing',
      detail: `${failedCount} of ${checkRuns.length} GitHub checks failed`,
    }
  }

  if (commitStatus?.state === 'success') {
    return { status: 'passing', detail: 'GitHub commit status passed' }
  }

  if (checkRuns.length > 0) {
    return {
      status: 'passing',
      detail: `${checkRuns.length} GitHub check${checkRuns.length === 1 ? '' : 's'} passed`,
    }
  }

  return null
}

export function summarizeDeployments(deployments: DeploymentWithStatus[]): {
  status: LatestDeploymentStatus
  environment?: string
  url?: string
  detail: string
} | null {
  const completedDeployments = deployments.filter(({ latestStatus }) => latestStatus?.state)
  const activeDeployment = completedDeployments.find(
    ({ latestStatus }) => latestStatus?.state === 'success'
  )

  if (activeDeployment?.latestStatus) {
    const environment =
      activeDeployment.latestStatus.environment ??
      activeDeployment.deployment.environment ??
      undefined
    return {
      status: 'deployed',
      environment,
      url:
        activeDeployment.latestStatus.environment_url ??
        activeDeployment.latestStatus.target_url ??
        activeDeployment.latestStatus.log_url ??
        undefined,
      detail:
        activeDeployment.latestStatus.description ??
        `Active${environment ? ` ${environment}` : ''} deployment detected`,
    }
  }

  if (
    completedDeployments.some(({ latestStatus }) =>
      ['queued', 'pending', 'in_progress'].includes(latestStatus?.state ?? '')
    )
  ) {
    return null
  }

  const failedDeployment = completedDeployments.find(({ latestStatus }) =>
    ['failure', 'error', 'inactive'].includes(latestStatus?.state ?? '')
  )
  if (!failedDeployment?.latestStatus) {
    return null
  }

  const environment =
    failedDeployment.latestStatus.environment ??
    failedDeployment.deployment.environment ??
    undefined
  return {
    status: 'not-deployed',
    environment,
    url:
      failedDeployment.latestStatus.log_url ??
      failedDeployment.latestStatus.target_url ??
      undefined,
    detail:
      failedDeployment.latestStatus.description ??
      `Latest${environment ? ` ${environment}` : ''} deployment is ${failedDeployment.latestStatus.state}`,
  }
}

export async function validatePat(token: string): Promise<{
  status: 'connected' | 'invalid' | 'rate-limited'
  login?: string
  name?: string
  avatarUrl?: string
  htmlUrl?: string
  rateLimitResetAt?: number
  error?: string
}> {
  try {
    const user = await fetchGitHubJson<{
      login: string
      name?: string | null
      avatar_url?: string
      html_url?: string
    }>('/user', { token })
    return {
      status: 'connected',
      login: user.login,
      name: user.name ?? undefined,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
    }
  } catch (error) {
    if (error instanceof GitHubHttpError) {
      if (error.status === 403 && error.rateLimitResetAt) {
        return {
          status: 'rate-limited',
          rateLimitResetAt: error.rateLimitResetAt,
          error: 'GitHub rate limit reached',
        }
      }

      if (error.status === 401) {
        return { status: 'invalid', error: 'Invalid GitHub personal access token' }
      }
    }

    return { status: 'invalid', error: 'Failed to validate GitHub token' }
  }
}

type ParsedSemver = {
  major: number
  minor: number
  patch: number
}

function parseSemver(version: string): ParsedSemver | null {
  const cleaned = version.trim().replace(/^[~^<>=v\s]+/, '')
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    return null
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export function classifyVersionUpdate(
  currentVersion: string,
  latestVersion: string
): 'none' | 'patch' | 'minor' | 'major' | 'unknown' {
  const current = parseSemver(currentVersion)
  const latest = parseSemver(latestVersion)
  if (!current || !latest) {
    return 'unknown'
  }

  if (
    latest.major === current.major &&
    latest.minor === current.minor &&
    latest.patch === current.patch
  ) {
    return 'none'
  }

  if (latest.major > current.major) {
    return 'major'
  }

  if (latest.minor > current.minor) {
    return 'minor'
  }

  if (latest.patch > current.patch) {
    return 'patch'
  }

  return 'none'
}

export function statusForPackageUpdate(
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown',
  policy: PackagePolicy | undefined,
  latestPublishedAt?: number,
  now = Date.now()
): 'ok' | 'warning' | 'unknown' {
  const effectivePolicy = policy ?? DEFAULT_PACKAGE_POLICY
  if (updateType === 'unknown') {
    return 'unknown'
  }
  if (updateType === 'none') {
    return 'ok'
  }
  if (updateType === 'patch') {
    return 'ok'
  }
  if (!latestPublishedAt || now - latestPublishedAt < PACKAGE_UPDATE_MINIMUM_AGE_MS) {
    return 'ok'
  }
  if (effectivePolicy === 'major-only') {
    return updateType === 'major' ? 'warning' : 'ok'
  }
  return updateType === 'major' || updateType === 'minor' ? 'warning' : 'ok'
}

export async function fetchNpmLatestVersion(packageName: string): Promise<{
  version: string
  publishedAt?: number
} | null> {
  const encodedPackage = encodeURIComponent(packageName)
  const response = await fetch(`${NPM_REGISTRY_BASE}/${encodedPackage}`, {
    headers: {
      Accept: 'application/vnd.npm.install-v1+json',
    },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    'dist-tags'?: { latest?: string }
    time?: Record<string, string>
  }
  const version = data['dist-tags']?.latest
  if (!version) {
    return null
  }
  const publishedAt = data.time?.[version] ? Date.parse(data.time[version]) : NaN
  return {
    version,
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : undefined,
  }
}
