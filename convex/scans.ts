import { action, mutation, query, type ActionCtx } from './_generated/server'
import { api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import {
  DEFAULT_CONNECTION_KEY,
  DEFAULT_PACKAGE_POLICY,
  type HealthStatus,
  type PackagePolicy,
} from './constants'
import {
  evaluateReadmeFreshness,
  evaluateTestsConfigured,
  isRequiredChecklistFinding,
  summarizeStatuses,
  type ChecklistFinding,
} from './checklist'
import {
  GitHubHttpError,
  classifyVersionUpdate,
  fetchGitHubJson,
  fetchNpmLatestVersion,
  summarizeCheckRuns,
  statusForPackageUpdate,
  type LatestCommitBuildStatus,
} from './github'
import { resolveGitHubToken } from './tokenSource'

type GitHubRepository = {
  id: number
  name: string
  full_name: string
  language?: string | null
  private: boolean
  html_url: string
  default_branch: string
  created_at: string
  updated_at: string
  owner: {
    login: string
  }
  pushed_at: string
}

type GitHubContentResponse = {
  type: 'file' | 'dir'
  content?: string
  encoding?: string
}

type PackageFinding = {
  packageName: string
  currentVersion: string
  latestVersion: string
  latestPublishedAt?: number
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown'
  status: HealthStatus
}

type LatestCommitBuild = {
  status: LatestCommitBuildStatus
  commitSha?: string
  commitUrl?: string
  detail: string
}

const MAX_DEPENDENCIES_TO_SCAN = 300

export const listRepositories = query({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) =>
        q.eq('connectionKey', args.connectionKey ?? DEFAULT_CONNECTION_KEY)
      )
      .first()

    if (!connection) {
      return []
    }

    return await ctx.db
      .query('repositories')
      .withIndex('by_connection', (q) => q.eq('connectionId', connection._id))
      .collect()
  },
})

export const getRepositoryForScan = query({
  args: {
    repositoryId: v.id('repositories'),
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) =>
        q.eq('connectionKey', args.connectionKey ?? DEFAULT_CONNECTION_KEY)
      )
      .first()

    if (!connection) {
      return null
    }

    const repository = await ctx.db.get(args.repositoryId)
    if (!repository || repository.connectionId !== connection._id) {
      return null
    }

    return repository
  },
})

export const getRepositoriesForScan = query({
  args: {
    repositoryIds: v.array(v.id('repositories')),
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) =>
        q.eq('connectionKey', args.connectionKey ?? DEFAULT_CONNECTION_KEY)
      )
      .first()

    if (!connection) {
      return []
    }

    const seen = new Set<Id<'repositories'>>()
    const repositories: Doc<'repositories'>[] = []
    for (const repositoryId of args.repositoryIds) {
      if (seen.has(repositoryId)) {
        continue
      }
      seen.add(repositoryId)

      const repository = await ctx.db.get(repositoryId)
      if (!repository || repository.connectionId !== connection._id) {
        continue
      }

      repositories.push(repository)
    }

    return repositories
  },
})

export const listRepositoryDashboard = query({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) =>
        q.eq('connectionKey', args.connectionKey ?? DEFAULT_CONNECTION_KEY)
      )
      .first()

    if (!connection) {
      return []
    }

    const repositories = await ctx.db
      .query('repositories')
      .withIndex('by_connection', (q) => q.eq('connectionId', connection._id))
      .collect()

    const dashboard = []
    for (const repository of repositories) {
      const scanRunId = repository.lastScanRunId
      const packageFindings = scanRunId
        ? await ctx.db
            .query('packageFindings')
            .withIndex('by_repository_and_scan', (q) =>
              q.eq('repositoryId', repository._id).eq('scanRunId', scanRunId)
            )
            .collect()
        : []

      const checklistFindings = scanRunId
        ? await ctx.db
            .query('checklistFindings')
            .withIndex('by_repository_and_scan', (q) =>
              q.eq('repositoryId', repository._id).eq('scanRunId', scanRunId)
            )
            .collect()
        : []

      dashboard.push({
        ...repository,
        packageFindings,
        checklistFindings,
      })
    }

    return dashboard.sort((a, b) => a.fullName.localeCompare(b.fullName))
  },
})

export const createScanRun = mutation({
  args: {
    connectionId: v.id('githubConnections'),
    scope: v.union(v.literal('all'), v.literal('single'), v.literal('scheduled')),
    repositoryId: v.optional(v.id('repositories')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('scanRuns', {
      connectionId: args.connectionId,
      scope: args.scope,
      status: 'running',
      repositoryId: args.repositoryId,
      startedAt: Date.now(),
      scannedCount: 0,
      successCount: 0,
      failedCount: 0,
    })
  },
})

export const finalizeScanRun = mutation({
  args: {
    scanRunId: v.id('scanRuns'),
    status: v.union(v.literal('completed'), v.literal('partial'), v.literal('failed')),
    scannedCount: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanRunId, {
      status: args.status,
      finishedAt: Date.now(),
      scannedCount: args.scannedCount,
      successCount: args.successCount,
      failedCount: args.failedCount,
      errorSummary: args.errorSummary,
    })
  },
})

export const upsertRepositories = mutation({
  args: {
    connectionId: v.id('githubConnections'),
    repositories: v.array(
      v.object({
        githubId: v.number(),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        primaryLanguage: v.optional(v.string()),
        visibility: v.union(v.literal('public'), v.literal('private')),
        defaultBranch: v.string(),
        htmlUrl: v.string(),
        githubCreatedAt: v.optional(v.number()),
        githubUpdatedAt: v.optional(v.number()),
        pushedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const idsByFullName: Record<string, Id<'repositories'>> = {}

    for (const repo of args.repositories) {
      const existing = await ctx.db
        .query('repositories')
        .withIndex('by_connection_full_name', (q) =>
          q.eq('connectionId', args.connectionId).eq('fullName', repo.fullName)
        )
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, {
          githubId: repo.githubId,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          primaryLanguage: repo.primaryLanguage,
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
          githubCreatedAt: repo.githubCreatedAt,
          githubUpdatedAt: repo.githubUpdatedAt,
          pushedAt: repo.pushedAt,
          updatedAt: now,
        })
        idsByFullName[repo.fullName] = existing._id
      } else {
        const id = await ctx.db.insert('repositories', {
          connectionId: args.connectionId,
          githubId: repo.githubId,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          primaryLanguage: repo.primaryLanguage,
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
          githubCreatedAt: repo.githubCreatedAt,
          githubUpdatedAt: repo.githubUpdatedAt,
          pushedAt: repo.pushedAt,
          createdAt: now,
          updatedAt: now,
        })
        idsByFullName[repo.fullName] = id
      }
    }

    return idsByFullName
  },
})

export const saveRepositoryScanResult = mutation({
  args: {
    repositoryId: v.id('repositories'),
    scanRunId: v.id('scanRuns'),
    hasPackageJson: v.boolean(),
    packageFindings: v.array(
      v.object({
        packageName: v.string(),
        currentVersion: v.string(),
        latestVersion: v.string(),
        latestPublishedAt: v.optional(v.number()),
        updateType: v.union(
          v.literal('none'),
          v.literal('patch'),
          v.literal('minor'),
          v.literal('major'),
          v.literal('unknown')
        ),
        status: v.union(
          v.literal('ok'),
          v.literal('warning'),
          v.literal('missing'),
          v.literal('stale'),
          v.literal('error'),
          v.literal('unknown')
        ),
      })
    ),
    checklistFindings: v.array(
      v.object({
        checkKey: v.string(),
        status: v.union(
          v.literal('ok'),
          v.literal('warning'),
          v.literal('missing'),
          v.literal('stale'),
          v.literal('error'),
          v.literal('unknown')
        ),
        detail: v.optional(v.string()),
      })
    ),
    repositoryStatus: v.union(
      v.literal('ok'),
      v.literal('warning'),
      v.literal('missing'),
      v.literal('stale'),
      v.literal('error'),
      v.literal('unknown')
    ),
    repositoryError: v.optional(v.string()),
    latestCommitBuild: v.optional(
      v.object({
        status: v.union(
          v.literal('passing'),
          v.literal('failing'),
          v.literal('pending'),
          v.literal('not-configured'),
          v.literal('unknown')
        ),
        commitSha: v.optional(v.string()),
        commitUrl: v.optional(v.string()),
        detail: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const buildStatusUpdate = args.latestCommitBuild
      ? {
          latestCommitSha: args.latestCommitBuild.commitSha,
          latestCommitUrl: args.latestCommitBuild.commitUrl,
          latestCommitBuildStatus: args.latestCommitBuild.status,
          latestCommitBuildDetail: args.latestCommitBuild.detail,
          latestCommitBuildCheckedAt: now,
        }
      : {}

    await ctx.db.patch(args.repositoryId, {
      hasPackageJson: args.hasPackageJson,
      lastScanAt: now,
      lastScanRunId: args.scanRunId,
      lastScanStatus: args.repositoryStatus,
      lastScanError: args.repositoryError,
      ...buildStatusUpdate,
      updatedAt: now,
    })

    for (const finding of args.packageFindings) {
      await ctx.db.insert('packageFindings', {
        repositoryId: args.repositoryId,
        scanRunId: args.scanRunId,
        packageName: finding.packageName,
        currentVersion: finding.currentVersion,
        latestVersion: finding.latestVersion,
        latestPublishedAt: finding.latestPublishedAt,
        updateType: finding.updateType,
        status: finding.status,
        createdAt: now,
      })
    }

    for (const check of args.checklistFindings) {
      await ctx.db.insert('checklistFindings', {
        repositoryId: args.repositoryId,
        scanRunId: args.scanRunId,
        checkKey: check.checkKey,
        status: check.status,
        detail: check.detail,
        checkedAt: now,
      })
    }
  },
})

export const triggerScanAll = mutation({
  args: {
    connectionKey: v.optional(v.string()),
    repositoryIds: v.optional(v.array(v.id('repositories'))),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) =>
        q.eq('connectionKey', args.connectionKey ?? DEFAULT_CONNECTION_KEY)
      )
      .first()

    if (!connection) {
      return { ok: false, message: 'GitHub connection not found' } as const
    }

    if (connection.status !== 'connected') {
      return { ok: false, message: 'GitHub connection is not valid' } as const
    }

    if ((args.repositoryIds?.length ?? 0) > 10) {
      return { ok: false, message: 'Select at most 10 repositories per scan' } as const
    }

    if ((args.repositoryIds?.length ?? 0) === 0) {
      return { ok: false, message: 'Select repositories to scan (max 10)' } as const
    }

    await ctx.scheduler.runAfter(0, api.scans.scanAllRepositories, {
      connectionKey: args.connectionKey ?? DEFAULT_CONNECTION_KEY,
      scope: 'all',
      repositoryIds: args.repositoryIds,
    })

    return { ok: true } as const
  },
})

export const triggerScanSingleRepository = mutation({
  args: {
    repositoryId: v.id('repositories'),
  },
  handler: async (ctx, args) => {
    const repository = await ctx.db.get(args.repositoryId)
    if (!repository) {
      return { ok: false, message: 'Repository not found' } as const
    }

    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', DEFAULT_CONNECTION_KEY))
      .first()

    if (!connection) {
      return { ok: false, message: 'GitHub connection not found' } as const
    }

    if (repository.connectionId !== connection._id) {
      return {
        ok: false,
        message: 'Repository does not belong to active GitHub connection',
      } as const
    }

    if (connection.status !== 'connected') {
      return { ok: false, message: 'GitHub connection is not ready' } as const
    }

    const connectionToken = resolveGitHubToken(connection)
    if (!connectionToken) {
      return { ok: false, message: 'OAuth token source is not implemented yet' } as const
    }

    await ctx.scheduler.runAfter(0, api.scans.scanSingleRepository, {
      repositoryId: args.repositoryId,
    })
    return { ok: true } as const
  },
})

export const runScheduledScan = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    return await ctx.runAction(api.scans.scanAllRepositories, {
      connectionKey: DEFAULT_CONNECTION_KEY,
      scope: 'scheduled',
    })
  },
})

export const scanSingleRepository = action({
  args: {
    repositoryId: v.id('repositories'),
  },
  handler: async (ctx, args) => {
    const target: Doc<'repositories'> | null = await ctx.runQuery(api.scans.getRepositoryForScan, {
      repositoryId: args.repositoryId,
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    if (!target) {
      return { ok: false, message: 'Repository not found' } as const
    }

    const connection = await ctx.runQuery(api.githubConnections.getConnectionForScanner, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    if (!connection) {
      return { ok: false, message: 'GitHub connection is not ready' } as const
    }

    const scanRunId = await ctx.runMutation(api.scans.createScanRun, {
      connectionId: connection._id,
      scope: 'single',
      repositoryId: target._id,
    })

    if (connection.status !== 'connected') {
      const repositoryError = 'GitHub connection is not ready'
      await ctx.runMutation(api.scans.saveRepositoryScanResult, {
        repositoryId: target._id,
        scanRunId,
        hasPackageJson: false,
        packageFindings: [],
        checklistFindings: [],
        repositoryStatus: 'error',
        repositoryError,
      })
      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status: 'failed',
        scannedCount: 1,
        successCount: 0,
        failedCount: 1,
        errorSummary: repositoryError,
      })
      return { ok: false, message: repositoryError } as const
    }

    const connectionToken = resolveGitHubToken(connection)
    if (!connectionToken) {
      const repositoryError = 'OAuth token source is not implemented yet'
      await ctx.runMutation(api.scans.saveRepositoryScanResult, {
        repositoryId: target._id,
        scanRunId,
        hasPackageJson: false,
        packageFindings: [],
        checklistFindings: [],
        repositoryStatus: 'error',
        repositoryError,
      })
      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status: 'failed',
        scannedCount: 1,
        successCount: 0,
        failedCount: 1,
        errorSummary: repositoryError,
      })
      return { ok: false, message: repositoryError } as const
    }

    try {
      await runRepositoryScan(ctx, {
        connectionToken,
        packagePolicy: connection.packagePolicy,
        repository: {
          id: target.githubId,
          name: target.name,
          full_name: target.fullName,
          owner: { login: target.owner },
          private: target.visibility === 'private',
          html_url: target.htmlUrl,
          language: target.primaryLanguage,
          default_branch: target.defaultBranch,
          created_at: target.githubCreatedAt ? new Date(target.githubCreatedAt).toISOString() : '',
          updated_at: target.githubUpdatedAt ? new Date(target.githubUpdatedAt).toISOString() : '',
          pushed_at: target.pushedAt ? new Date(target.pushedAt).toISOString() : '',
        },
        repositoryId: target._id,
        scanRunId,
      })

      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status: 'completed',
        scannedCount: 1,
        successCount: 1,
        failedCount: 0,
      })
      return { ok: true } as const
    } catch (error) {
      await ctx.runMutation(api.scans.saveRepositoryScanResult, {
        repositoryId: target._id,
        scanRunId,
        hasPackageJson: false,
        packageFindings: [],
        checklistFindings: [],
        repositoryStatus: 'error',
        repositoryError: extractMessage(error),
      })
      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status: 'failed',
        scannedCount: 1,
        successCount: 0,
        failedCount: 1,
        errorSummary: extractMessage(error),
      })
      return { ok: false, message: extractMessage(error) } as const
    }
  },
})

export const scanAllRepositories = action({
  args: {
    connectionKey: v.optional(v.string()),
    scope: v.optional(v.union(v.literal('all'), v.literal('scheduled'))),
    repositoryIds: v.optional(v.array(v.id('repositories'))),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(api.githubConnections.getConnectionForScanner, {
      connectionKey: args.connectionKey ?? DEFAULT_CONNECTION_KEY,
    })
    if (!connection) {
      return { ok: false, message: 'Connection not found' } as const
    }
    if (connection.status !== 'connected') {
      return { ok: false, message: 'Connection not healthy' } as const
    }
    const connectionToken = resolveGitHubToken(connection)
    if (!connectionToken) {
      return { ok: false, message: 'OAuth token source is not implemented yet' } as const
    }

    if ((args.repositoryIds?.length ?? 0) > 10) {
      return { ok: false, message: 'Select at most 10 repositories per scan' } as const
    }

    const scanRunId = await ctx.runMutation(api.scans.createScanRun, {
      connectionId: connection._id,
      scope: args.scope ?? 'all',
    })

    try {
      let reposFromGitHub: GitHubRepository[] = []
      let repoMap: Record<string, Id<'repositories'>> = {}

      if (args.repositoryIds && args.repositoryIds.length > 0) {
        const selected: Doc<'repositories'>[] = await ctx.runQuery(
          api.scans.getRepositoriesForScan,
          {
            repositoryIds: args.repositoryIds,
            connectionKey: args.connectionKey ?? DEFAULT_CONNECTION_KEY,
          }
        )

        if (selected.length === 0) {
          await ctx.runMutation(api.scans.finalizeScanRun, {
            scanRunId,
            status: 'failed',
            scannedCount: 0,
            successCount: 0,
            failedCount: 0,
            errorSummary: 'Selected repositories were not found',
          })
          return { ok: false, message: 'Selected repositories were not found' } as const
        }

        reposFromGitHub = selected.map((repository) => ({
          id: repository.githubId,
          name: repository.name,
          full_name: repository.fullName,
          language: repository.primaryLanguage,
          private: repository.visibility === 'private',
          html_url: repository.htmlUrl,
          default_branch: repository.defaultBranch,
          created_at: repository.githubCreatedAt
            ? new Date(repository.githubCreatedAt).toISOString()
            : new Date(repository._creationTime).toISOString(),
          updated_at: repository.githubUpdatedAt
            ? new Date(repository.githubUpdatedAt).toISOString()
            : new Date(repository._creationTime).toISOString(),
          owner: {
            login: repository.owner,
          },
          pushed_at: repository.pushedAt
            ? new Date(repository.pushedAt).toISOString()
            : new Date(repository._creationTime).toISOString(),
        }))

        for (const repository of selected) {
          repoMap[repository.fullName] = repository._id
        }
      } else {
        reposFromGitHub = await fetchAllRepositories(connectionToken)
        repoMap = await ctx.runMutation(api.scans.upsertRepositories, {
          connectionId: connection._id,
          repositories: reposFromGitHub.map((repo) => {
            const visibility: 'public' | 'private' = repo.private ? 'private' : 'public'
            return {
              githubId: repo.id,
              owner: repo.owner.login,
              name: repo.name,
              fullName: repo.full_name,
              primaryLanguage: repo.language ?? undefined,
              visibility,
              defaultBranch: repo.default_branch,
              htmlUrl: repo.html_url,
              githubCreatedAt: repo.created_at ? new Date(repo.created_at).getTime() : undefined,
              githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at).getTime() : undefined,
              pushedAt: repo.pushed_at ? new Date(repo.pushed_at).getTime() : undefined,
            }
          }),
        })
      }

      let successCount = 0
      let failedCount = 0

      for (const repo of reposFromGitHub) {
        const repositoryId = repoMap[repo.full_name]
        if (!repositoryId) {
          failedCount += 1
          continue
        }

        try {
          await runRepositoryScan(ctx, {
            connectionToken,
            packagePolicy: connection.packagePolicy,
            repository: repo,
            repositoryId,
            scanRunId,
          })
          successCount += 1
        } catch (error) {
          failedCount += 1
          await ctx.runMutation(api.scans.saveRepositoryScanResult, {
            repositoryId,
            scanRunId,
            hasPackageJson: false,
            packageFindings: [],
            checklistFindings: [],
            repositoryStatus: 'error',
            repositoryError: extractMessage(error),
          })
        }
      }

      const status = failedCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial'

      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status,
        scannedCount: reposFromGitHub.length,
        successCount,
        failedCount,
        errorSummary: failedCount > 0 ? `${failedCount} repositories failed` : undefined,
      })

      return {
        ok: true,
        scannedCount: reposFromGitHub.length,
        successCount,
        failedCount,
      } as const
    } catch (error) {
      await ctx.runMutation(api.scans.finalizeScanRun, {
        scanRunId,
        status: 'failed',
        scannedCount: 0,
        successCount: 0,
        failedCount: 0,
        errorSummary: extractMessage(error),
      })
      return { ok: false, message: extractMessage(error) } as const
    }
  },
})

async function fetchAllRepositories(token: string): Promise<GitHubRepository[]> {
  const allRepositories: GitHubRepository[] = []
  let page = 1

  while (true) {
    const repositories = await fetchGitHubJson<GitHubRepository[]>(
      `/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&page=${page}`,
      { token }
    )
    if (repositories.length === 0) {
      break
    }
    allRepositories.push(...repositories)
    if (repositories.length < 100) {
      break
    }
    page += 1
  }

  return allRepositories
}

async function runRepositoryScan(
  ctx: ActionCtx,
  args: {
    connectionToken: string
    packagePolicy: PackagePolicy | undefined
    repository: GitHubRepository
    repositoryId: Id<'repositories'>
    scanRunId: Id<'scanRuns'>
  }
) {
  const latestCommitBuild = await fetchLatestCommitBuild(args.connectionToken, args.repository)
  const packageJsonResult = await fetchPackageJson(args.connectionToken, args.repository)
  let dependencyCapDetail: string | null = null

  const packageFindings: PackageFinding[] = []
  if (packageJsonResult.ok) {
    const dependencies = {
      ...(packageJsonResult.packageJson.dependencies ?? {}),
      ...(packageJsonResult.packageJson.devDependencies ?? {}),
    }

    const dependencyEntries = Object.entries(dependencies)
    const dependenciesToScan = dependencyEntries.slice(0, MAX_DEPENDENCIES_TO_SCAN)

    for (const [packageName, currentVersion] of dependenciesToScan) {
      const npmLatest = await fetchNpmLatestVersion(packageName)
      const latestVersion = npmLatest?.version ?? currentVersion
      const updateType = npmLatest
        ? classifyVersionUpdate(currentVersion, npmLatest.version)
        : 'unknown'

      packageFindings.push({
        packageName,
        currentVersion,
        latestVersion,
        latestPublishedAt: npmLatest?.publishedAt,
        updateType,
        status: statusForPackageUpdate(
          updateType,
          args.packagePolicy ?? DEFAULT_PACKAGE_POLICY,
          npmLatest?.publishedAt
        ),
      })
    }

    if (dependencyEntries.length > dependenciesToScan.length) {
      const skippedCount = dependencyEntries.length - dependenciesToScan.length
      packageFindings.push({
        packageName: 'dependency-scan-cap',
        currentVersion: String(dependenciesToScan.length),
        latestVersion: String(dependencyEntries.length),
        updateType: 'unknown',
        status: 'warning',
      })

      dependencyCapDetail =
        `Scanned ${dependenciesToScan.length} dependencies and skipped ${skippedCount} ` +
        `to stay within memory limits.`
    }
  }

  const checklistFindings: ChecklistFinding[] = await evaluateChecklist(
    args.connectionToken,
    args.repository,
    packageJsonResult.ok ? packageJsonResult.packageJson : null
  )
  if (dependencyCapDetail) {
    checklistFindings.push({
      checkKey: 'dependency-scan-cap',
      status: 'warning',
      detail: dependencyCapDetail,
    })
  }

  const combinedStatuses = [
    ...packageFindings.map((finding) => finding.status),
    ...checklistFindings
      .filter((finding) => isRequiredChecklistFinding(finding.checkKey))
      .map((finding) => finding.status),
  ]
  const repositoryStatus = summarizeStatuses(combinedStatuses)

  await ctx.runMutation(api.scans.saveRepositoryScanResult, {
    repositoryId: args.repositoryId,
    scanRunId: args.scanRunId,
    hasPackageJson: packageJsonResult.ok,
    packageFindings,
    checklistFindings,
    repositoryStatus,
    repositoryError: packageJsonResult.ok ? undefined : packageJsonResult.error,
    latestCommitBuild,
  })
}

async function fetchLatestCommitBuild(
  token: string,
  repository: GitHubRepository
): Promise<LatestCommitBuild> {
  try {
    const commit = await fetchGitHubJson<{ sha: string; html_url?: string }>(
      `/repos/${repository.owner.login}/${repository.name}/commits/${encodeURIComponent(
        repository.default_branch
      )}`,
      { token }
    )
    const checkRuns = await fetchGitHubJson<{
      check_runs: Array<{ status: string; conclusion?: string | null }>
    }>(
      `/repos/${repository.owner.login}/${repository.name}/commits/${commit.sha}/check-runs?per_page=100`,
      { token }
    )
    const summary = summarizeCheckRuns(checkRuns.check_runs)
    return {
      status: summary.status,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      detail: summary.detail,
    }
  } catch (error) {
    return {
      status: 'unknown',
      detail: `Could not load GitHub build checks: ${extractMessage(error)}`,
    }
  }
}

async function fetchPackageJson(token: string, repository: GitHubRepository) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository.owner.login}/${repository.name}/contents/package.json?ref=${repository.default_branch}`,
      {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'repo-monitor',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, error: 'package.json missing' } as const
      }
      throw new GitHubHttpError(
        `GitHub API request failed: ${response.status}`,
        response.status,
        null
      )
    }

    const rawPackageJson = await response.text()
    if (rawPackageJson.length > 1_000_000) {
      return { ok: false, error: 'package.json too large to scan safely' } as const
    }

    const packageJson = JSON.parse(rawPackageJson) as {
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    return { ok: true, packageJson } as const
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return { ok: false, error: 'package.json missing' } as const
    }
    throw error
  }
}

async function evaluateChecklist(
  token: string,
  repository: GitHubRepository,
  packageJson: {
    scripts?: Record<string, string>
  } | null
): Promise<ChecklistFinding[]> {
  const findings: ChecklistFinding[] = []

  findings.push(evaluateTestsConfigured(packageJson?.scripts?.test))

  const ciExists = await directoryExists(
    token,
    repository.owner.login,
    repository.name,
    '.github/workflows',
    repository.default_branch
  )
  findings.push({
    checkKey: 'cicd-workflow',
    status: ciExists ? 'ok' : 'missing',
    detail: ciExists ? 'Workflow directory exists' : 'No .github/workflows directory',
  })

  const readmeExists = await fileExists(
    token,
    repository.owner.login,
    repository.name,
    'README.md',
    repository.default_branch
  )
  findings.push({
    checkKey: 'readme-exists',
    status: readmeExists ? 'ok' : 'missing',
    detail: readmeExists ? 'README.md found' : 'README.md missing',
  })

  if (readmeExists) {
    const readmeCommitDate = await getFileLastCommitDate(
      token,
      repository.owner.login,
      repository.name,
      'README.md'
    )
    findings.push(evaluateReadmeFreshness(true, readmeCommitDate))
  } else {
    findings.push(evaluateReadmeFreshness(false, null))
  }

  const dependabotExists =
    (await fileExists(
      token,
      repository.owner.login,
      repository.name,
      '.github/dependabot.yml',
      repository.default_branch
    )) ||
    (await fileExists(
      token,
      repository.owner.login,
      repository.name,
      '.github/dependabot.yaml',
      repository.default_branch
    ))

  findings.push(await evaluateSecurityAlerts(token, repository))

  findings.push({
    checkKey: 'dependabot-config',
    status: dependabotExists ? 'ok' : 'missing',
    detail: dependabotExists ? 'Dependabot config file found' : 'Dependabot config file missing',
  })

  return findings
}

async function evaluateSecurityAlerts(
  token: string,
  repository: GitHubRepository
): Promise<ChecklistFinding> {
  try {
    const alerts = await fetchGitHubJson<
      Array<{
        state?: string
        security_advisory?: { severity?: string }
      }>
    >(
      `/repos/${repository.owner.login}/${repository.name}/dependabot/alerts?state=open&per_page=100`,
      { token }
    )
    const openAlerts = alerts.filter((alert) => alert.state === 'open')
    if (openAlerts.length === 0) {
      return {
        checkKey: 'security-advisories',
        status: 'ok',
        detail: 'No open Dependabot alerts',
      }
    }

    const severities = Array.from(
      new Set(openAlerts.map((alert) => alert.security_advisory?.severity).filter(Boolean))
    ).join(', ')
    return {
      checkKey: 'security-advisories',
      status: 'warning',
      detail: `${openAlerts.length} open Dependabot alert${openAlerts.length === 1 ? '' : 's'}${severities ? ` (${severities})` : ''}`,
    }
  } catch (error) {
    if (error instanceof GitHubHttpError && (error.status === 403 || error.status === 404)) {
      return {
        checkKey: 'security-advisories',
        status: 'unknown',
        detail: 'Dependabot alerts are unavailable for this token or repository',
      }
    }
    throw error
  }
}
async function directoryExists(
  token: string,
  owner: string,
  name: string,
  path: string,
  branch: string
) {
  try {
    await fetchGitHubJson<GitHubContentResponse[]>(
      `/repos/${owner}/${name}/contents/${path}?ref=${branch}`,
      { token }
    )
    return true
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return false
    }
    throw error
  }
}

async function fileExists(
  token: string,
  owner: string,
  name: string,
  path: string,
  branch: string
) {
  try {
    await fetchGitHubJson<GitHubContentResponse>(
      `/repos/${owner}/${name}/contents/${path}?ref=${branch}`,
      { token }
    )
    return true
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return false
    }
    throw error
  }
}

async function getFileLastCommitDate(token: string, owner: string, name: string, path: string) {
  try {
    const commits = await fetchGitHubJson<Array<{ commit?: { committer?: { date?: string } } }>>(
      `/repos/${owner}/${name}/commits?path=${encodeURIComponent(path)}&per_page=1`,
      {
        token,
      }
    )
    const date = commits[0]?.commit?.committer?.date
    return date ? new Date(date) : null
  } catch (error) {
    if (error instanceof GitHubHttpError && error.status === 404) {
      return null
    }
    throw error
  }
}

function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}
