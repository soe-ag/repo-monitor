import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

export const DEFAULT_CONNECTION_KEY = 'default'

export type HealthStatus = 'ok' | 'warning' | 'missing' | 'stale' | 'error' | 'unknown'

export type PackageFinding = {
  repositoryId?: string
  scanRunId?: string
  packageName: string
  currentVersion: string
  latestVersion: string
  latestPublishedAt?: number
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown'
  status: HealthStatus
  createdAt?: number
}

export type ChecklistFinding = {
  repositoryId?: string
  scanRunId?: string
  checkKey: string
  status: HealthStatus
  detail?: string
  checkedAt?: number
}

export type DashboardRepository = {
  _id: string
  connectionId: string
  owner: string
  name: string
  fullName: string
  primaryLanguage?: string
  visibility: 'public' | 'private'
  defaultBranch: string
  htmlUrl: string
  latestCommitBuildStatus?: 'passing' | 'failing'
  latestCommitBuildDetail?: string
  latestCommitBuildCheckedAt?: number
  latestDeploymentStatus?: 'deployed' | 'not-deployed'
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

export type ConnectionState = {
  status: 'connected' | 'invalid' | 'rate-limited'
  connected: boolean
  packagePolicy?: 'any-newer' | 'minor-or-major' | 'major-only'
  rateLimitResetAt?: number
  lastValidatedAt?: number
  lastError?: string
  accountLogin?: string
  accountName?: string
  accountAvatarUrl?: string
  accountHtmlUrl?: string
}

export type RepoMonitorDataSource = {
  listDashboard: () => Promise<DashboardRepository[]>
  getConnectionState: () => Promise<ConnectionState>
}

export function createConvexDataSource(
  deploymentUrl: string,
  connectionKey = DEFAULT_CONNECTION_KEY
): RepoMonitorDataSource {
  const client = new ConvexHttpClient(deploymentUrl)

  return {
    listDashboard: () =>
      client.query(anyApi.scans.listRepositoryDashboard, { connectionKey }) as Promise<
        DashboardRepository[]
      >,
    getConnectionState: () =>
      client.query(anyApi.githubConnections.getConnectionState, {
        connectionKey,
      }) as Promise<ConnectionState>,
  }
}
