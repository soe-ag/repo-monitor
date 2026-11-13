import type { RepositoryHealthCard } from '@/components/repo-health-model'

const day = 24 * 60 * 60 * 1000
const repositoriesStorageKey = 'repo-monitor-demo-repositories'
const historyStorageKey = 'repo-monitor-demo-history'

export type DemoScanHistory = {
  _id: string
  startedAt: number
  finishedAt: number
  status: string
  repositoryStatus: string
  packageUpdateCount: number
  checklistIssueCount: number
}

export function saveDemoRepositories(repositories: RepositoryHealthCard[]) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(repositoriesStorageKey, JSON.stringify(repositories))
  }
}

export function recordDemoScan(repository: RepositoryHealthCard, scannedAt: number) {
  if (typeof window === 'undefined') return
  const stored = window.sessionStorage.getItem(historyStorageKey)
  const allHistory = stored ? (JSON.parse(stored) as Record<string, DemoScanHistory[]>) : {}
  const history = allHistory[repository._id] ?? []
  allHistory[repository._id] = [
    {
      _id: `${repository._id}-demo-run-${scannedAt}`,
      startedAt: scannedAt - 650,
      finishedAt: scannedAt,
      status: 'completed',
      repositoryStatus: repository.lastScanStatus ?? 'unknown',
      packageUpdateCount: repository.packageFindings.filter((finding) => finding.status === 'warning').length,
      checklistIssueCount: repository.checklistFindings.filter((finding) =>
        ['warning', 'missing', 'stale', 'error'].includes(finding.status)
      ).length,
    },
    ...history,
  ].slice(0, 20)
  window.sessionStorage.setItem(historyStorageKey, JSON.stringify(allHistory))
}

export function getDemoScanHistory(repositoryId: string) {
  if (typeof window === 'undefined') return []
  const stored = window.sessionStorage.getItem(historyStorageKey)
  if (!stored) return []
  try {
    const history = JSON.parse(stored) as Record<string, DemoScanHistory[]>
    return history[repositoryId] ?? []
  } catch {
    return []
  }
}

export function getDemoRepositories(): RepositoryHealthCard[] {
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem(repositoriesStorageKey)
    if (stored) {
      try {
        const repositories = JSON.parse(stored) as RepositoryHealthCard[]
        if (Array.isArray(repositories) && repositories.every((repo) => typeof repo?._id === 'string')) {
          return repositories
        }
      } catch {
        window.sessionStorage.removeItem(repositoriesStorageKey)
      }
    }
  }

  const now = Date.now()

  return [
    {
      _id: 'demo-1',
      _creationTime: now - 420 * day,
      fullName: 'octo-labs/storefront',
      htmlUrl: 'https://github.com/octo-labs/storefront',
      defaultBranch: 'main',
      primaryLanguage: 'TypeScript',
      hasPackageJson: true,
      packageManager: 'pnpm',
      visibility: 'public',
      githubCreatedAt: now - 420 * day,
      githubUpdatedAt: now - day,
      pushedAt: now - 2 * day,
      latestCommitSha: 'a91c7b2f6d8e4c11',
      latestCommitUrl: 'https://github.com/octo-labs/storefront/commit/a91c7b2',
      latestCommitBuildStatus: 'passing',
      latestCommitBuildDetail: 'All checks passed',
      latestDeploymentStatus: 'deployed',
      latestDeploymentEnvironment: 'production',
      latestDeploymentUrl: 'https://example.com',
      lastScanAt: now - 2 * 60 * 60 * 1000,
      lastScanStatus: 'warning',
      packageFindings: [
        { _id: 'demo-p1', packageName: 'next', currentVersion: '15.2.0', latestVersion: '15.3.1', updateType: 'minor', status: 'warning' },
        { _id: 'demo-p2', packageName: 'zod', currentVersion: '3.24.1', latestVersion: '3.24.3', updateType: 'patch', status: 'warning' },
        { _id: 'demo-p3', packageName: 'react', currentVersion: '19.0.0', latestVersion: '19.0.0', updateType: 'none', status: 'ok' },
      ],
      checklistFindings: [
        { _id: 'demo-c1', checkKey: 'tests-configured', status: 'ok', detail: 'Test script found' },
        { _id: 'demo-c2', checkKey: 'cicd-workflow', status: 'ok', detail: 'GitHub Actions workflow found' },
        { _id: 'demo-c3', checkKey: 'readme-exists', status: 'ok', detail: 'README.md found' },
        { _id: 'demo-c4', checkKey: 'readme-freshness', status: 'ok', detail: 'Updated recently' },
        { _id: 'demo-c5', checkKey: 'dependabot-config', status: 'ok', detail: 'Dependabot enabled' },
        { _id: 'demo-c6', checkKey: 'security-advisories', status: 'unknown', detail: 'No open alerts reported' },
      ],
    },
    {
      _id: 'demo-2',
      _creationTime: now - 900 * day,
      fullName: 'octo-labs/legacy-api',
      htmlUrl: 'https://github.com/octo-labs/legacy-api',
      defaultBranch: 'main',
      primaryLanguage: 'JavaScript',
      hasPackageJson: true,
      packageManager: 'npm',
      visibility: 'private',
      githubCreatedAt: now - 900 * day,
      githubUpdatedAt: now - 12 * day,
      pushedAt: now - 18 * day,
      latestCommitSha: 'c42d18e78b5a9012',
      latestCommitUrl: 'https://github.com/octo-labs/legacy-api/commit/c42d18e',
      latestCommitBuildStatus: 'failing',
      latestCommitBuildDetail: '1 check failed',
      latestDeploymentStatus: 'not-deployed',
      latestDeploymentDetail: 'No successful deployment found',
      lastScanAt: now - day,
      lastScanStatus: 'warning',
      packageFindings: [
        { _id: 'demo-p4', packageName: 'express', currentVersion: '4.18.2', latestVersion: '5.1.0', updateType: 'major', status: 'warning' },
        { _id: 'demo-p5', packageName: 'lodash', currentVersion: '4.17.20', latestVersion: '4.17.21', updateType: 'patch', status: 'warning' },
      ],
      checklistFindings: [
        { _id: 'demo-c7', checkKey: 'tests-configured', status: 'missing', detail: 'No test script found in package.json' },
        { _id: 'demo-c8', checkKey: 'cicd-workflow', status: 'ok', detail: 'GitHub Actions workflow found' },
        { _id: 'demo-c9', checkKey: 'readme-exists', status: 'ok', detail: 'README.md found' },
        { _id: 'demo-c10', checkKey: 'readme-freshness', status: 'stale', detail: 'Last updated over six months ago' },
        { _id: 'demo-c11', checkKey: 'dependabot-config', status: 'missing', detail: 'No Dependabot configuration found' },
      ],
    },
    {
      _id: 'demo-3',
      _creationTime: now - 120 * day,
      fullName: 'octo-labs/docs-site',
      htmlUrl: 'https://github.com/octo-labs/docs-site',
      defaultBranch: 'main',
      primaryLanguage: 'MDX',
      hasPackageJson: true,
      packageManager: 'npm',
      visibility: 'public',
      githubCreatedAt: now - 120 * day,
      githubUpdatedAt: now - 4 * day,
      pushedAt: now - 4 * day,
      latestCommitSha: '9b721e40af53cd81',
      latestCommitUrl: 'https://github.com/octo-labs/docs-site/commit/9b721e4',
      latestCommitBuildStatus: 'passing',
      latestCommitBuildDetail: 'All checks passed',
      latestDeploymentStatus: 'deployed',
      latestDeploymentEnvironment: 'preview',
      latestDeploymentUrl: 'https://docs.example.com',
      lastScanAt: now - 5 * 60 * 60 * 1000,
      lastScanStatus: 'ok',
      packageFindings: [
        { _id: 'demo-p6', packageName: 'vite', currentVersion: '6.1.0', latestVersion: '6.1.0', updateType: 'none', status: 'ok' },
      ],
      checklistFindings: [
        { _id: 'demo-c12', checkKey: 'tests-configured', status: 'ok', detail: 'Test script found' },
        { _id: 'demo-c13', checkKey: 'cicd-workflow', status: 'ok', detail: 'GitHub Actions workflow found' },
        { _id: 'demo-c14', checkKey: 'readme-exists', status: 'ok', detail: 'README.md found' },
        { _id: 'demo-c15', checkKey: 'readme-freshness', status: 'ok', detail: 'Updated recently' },
        { _id: 'demo-c16', checkKey: 'dependabot-config', status: 'unknown', detail: 'Not reported by GitHub' },
      ],
    },
    {
      _id: 'demo-4',
      _creationTime: now - 60 * day,
      fullName: 'octo-labs/landing-page',
      htmlUrl: 'https://github.com/octo-labs/landing-page',
      defaultBranch: 'main',
      primaryLanguage: 'HTML',
      hasPackageJson: false,
      visibility: 'public',
      githubCreatedAt: now - 60 * day,
      githubUpdatedAt: now - 7 * day,
      pushedAt: now - 7 * day,
      lastScanAt: undefined,
      lastScanStatus: 'unknown',
      packageFindings: [],
      checklistFindings: [],
    },
  ]
}
