/* eslint-disable @typescript-eslint/no-unused-vars */
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod/v4'
import {
  type ChecklistFinding,
  type DashboardRepository,
  type HealthStatus,
  type PackageFinding,
  type RepoMonitorDataSource,
} from './data'

type SafePackageFinding = Omit<PackageFinding, never>
type SafeChecklistFinding = Omit<ChecklistFinding, never>

export type SafeRepository = {
  fullName: string
  owner: string
  name: string
  visibility: DashboardRepository['visibility']
  primaryLanguage?: string
  defaultBranch: string
  htmlUrl: string
  build?: {
    status: DashboardRepository['latestCommitBuildStatus']
    detail?: string
    checkedAt?: number
  }
  deployment?: {
    status: DashboardRepository['latestDeploymentStatus']
    environment?: string
    url?: string
    detail?: string
    checkedAt?: number
  }
  scan?: {
    status?: HealthStatus
    scannedAt?: number
    error?: string
  }
  packageFindings: SafePackageFinding[]
  checklistFindings: SafeChecklistFinding[]
}

export type AttentionItem = {
  repository: string
  kind: 'scan' | 'package' | 'checklist' | 'build' | 'deployment'
  status: string
  detail: string
}

type ToolResult<T> = {
  content: [{ type: 'text'; text: string }]
  structuredContent: T
}

type ToolError = {
  error: {
    code: 'CONFIGURATION' | 'NOT_FOUND' | 'BACKEND_ERROR'
    message: string
  }
}

function safeRepository(repository: DashboardRepository): SafeRepository {
  return {
    fullName: repository.fullName,
    owner: repository.owner,
    name: repository.name,
    visibility: repository.visibility,
    primaryLanguage: repository.primaryLanguage,
    defaultBranch: repository.defaultBranch,
    htmlUrl: repository.htmlUrl,
    build: repository.latestCommitBuildStatus
      ? {
          status: repository.latestCommitBuildStatus,
          detail: repository.latestCommitBuildDetail,
          checkedAt: repository.latestCommitBuildCheckedAt,
        }
      : undefined,
    deployment: repository.latestDeploymentStatus
      ? {
          status: repository.latestDeploymentStatus,
          environment: repository.latestDeploymentEnvironment,
          url: repository.latestDeploymentUrl,
          detail: repository.latestDeploymentDetail,
          checkedAt: repository.latestDeploymentCheckedAt,
        }
      : undefined,
    scan: {
      status: repository.lastScanStatus,
      scannedAt: repository.lastScanAt,
      error: repository.lastScanError,
    },
    packageFindings: repository.packageFindings.map(
      ({
        repositoryId: _repositoryId,
        scanRunId: _scanRunId,
        createdAt: _createdAt,
        latestPublishedAt: _latestPublishedAt,
        ...finding
      }) => finding as SafePackageFinding
    ),
    checklistFindings: repository.checklistFindings.map(
      ({ repositoryId: _repositoryId, scanRunId: _scanRunId, checkedAt: _checkedAt, ...finding }) =>
        finding as SafeChecklistFinding
    ),
  }
}

function result<T>(summary: string, data: T): ToolResult<T> {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: data,
  }
}

function errorResult(error: ToolError): ToolResult<ToolError> & { isError: true } {
  return {
    ...result(error.error.message, error),
    isError: true,
  }
}

function sanitizedMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/\b(token|pat|secret|password)\b[^\s]*/gi, '[redacted]')
    : 'Convex request failed'
}

async function withBackendErrors<T>(operation: () => Promise<T>): Promise<T | ToolError> {
  try {
    return await operation()
  } catch (error) {
    return {
      error: {
        code: 'BACKEND_ERROR',
        message: `Repo Monitor backend request failed: ${sanitizedMessage(error)}`,
      },
    }
  }
}

function attentionItems(repositories: DashboardRepository[]): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const repository of repositories) {
    if (repository.lastScanStatus && repository.lastScanStatus !== 'ok') {
      items.push({
        repository: repository.fullName,
        kind: 'scan',
        status: repository.lastScanStatus,
        detail: repository.lastScanError ?? 'Repository scan needs attention',
      })
    }
    if (repository.latestCommitBuildStatus === 'failing') {
      items.push({
        repository: repository.fullName,
        kind: 'build',
        status: 'failing',
        detail: repository.latestCommitBuildDetail ?? 'Latest build is failing',
      })
    }
    if (repository.latestDeploymentStatus === 'not-deployed') {
      items.push({
        repository: repository.fullName,
        kind: 'deployment',
        status: 'not-deployed',
        detail: repository.latestDeploymentDetail ?? 'Repository is not deployed',
      })
    }
    for (const finding of repository.packageFindings) {
      if (finding.status !== 'ok') {
        items.push({
          repository: repository.fullName,
          kind: 'package',
          status: finding.status,
          detail: `${finding.packageName}: ${finding.currentVersion} → ${finding.latestVersion}`,
        })
      }
    }
    for (const finding of repository.checklistFindings) {
      if (finding.status !== 'ok') {
        items.push({
          repository: repository.fullName,
          kind: 'checklist',
          status: finding.status,
          detail: finding.detail ?? finding.checkKey,
        })
      }
    }
  }
  return items
}

export function createRepoMonitorServer(dataSource: RepoMonitorDataSource) {
  const server = new McpServer({ name: 'repo-monitor', version: '0.1.0' })

  server.registerTool(
    'list_repositories',
    { description: 'List repositories monitored by Repo Monitor.' },
    async () => {
      const data = await withBackendErrors(dataSource.listDashboard)
      if ('error' in data) return errorResult(data)
      const repositories = data.map(safeRepository)
      return result(`Found ${repositories.length} monitored repositories.`, { repositories })
    }
  )

  server.registerTool(
    'get_repository_health',
    {
      description:
        'Get the latest health summary and findings for a repository such as owner/name.',
      inputSchema: {
        fullName: z
          .string()
          .min(1)
          .describe('Repository full name, for example octocat/Hello-World'),
      },
    },
    async ({ fullName }) => {
      const data = await withBackendErrors(dataSource.listDashboard)
      if ('error' in data) return errorResult(data)
      const repository = data.find((item) => item.fullName.toLowerCase() === fullName.toLowerCase())
      if (!repository)
        return errorResult({
          error: { code: 'NOT_FOUND', message: `Repository '${fullName}' was not found.` },
        })
      return result(`Health summary for ${repository.fullName}.`, {
        repository: safeRepository(repository),
      })
    }
  )

  server.registerTool(
    'list_attention_items',
    { description: 'List repository health findings that need attention.' },
    async () => {
      const data = await withBackendErrors(dataSource.listDashboard)
      if ('error' in data) return errorResult(data)
      const items = attentionItems(data)
      return result(`Found ${items.length} attention items.`, { items })
    }
  )

  server.registerTool(
    'get_connection_status',
    {
      description:
        'Get the configured Repo Monitor connection status without exposing credentials.',
    },
    async () => {
      const data = await withBackendErrors(dataSource.getConnectionState)
      if ('error' in data) return errorResult(data)
      return result(`GitHub connection is ${data.status}.`, { connection: data })
    }
  )

  return server
}
