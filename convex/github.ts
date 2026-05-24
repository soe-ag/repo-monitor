import { DEFAULT_PACKAGE_POLICY, type PackagePolicy } from './constants'

const GITHUB_API_BASE = 'https://api.github.com'
const NPM_REGISTRY_BASE = 'https://registry.npmjs.org'

type FetchJsonOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  token: string
  body?: string
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
  policy: PackagePolicy | undefined
): 'ok' | 'warning' | 'unknown' {
  const effectivePolicy = policy ?? DEFAULT_PACKAGE_POLICY
  if (updateType === 'unknown') {
    return 'unknown'
  }
  if (updateType === 'none') {
    return 'ok'
  }
  if (effectivePolicy === 'any-newer') {
    return 'warning'
  }
  if (effectivePolicy === 'minor-or-major') {
    return updateType === 'major' || updateType === 'minor' ? 'warning' : 'ok'
  }
  return updateType === 'major' ? 'warning' : 'ok'
}

export async function fetchNpmLatestVersion(packageName: string): Promise<string | null> {
  const response = await fetch(
    `${NPM_REGISTRY_BASE}/${encodeURIComponent(packageName).replace(/%40/g, '@')}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as { 'dist-tags'?: { latest?: string } }
  return data['dist-tags']?.latest ?? null
}
