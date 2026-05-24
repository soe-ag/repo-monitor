import { anyApi, actionGeneric, mutationGeneric, queryGeneric } from 'convex/server'
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
  summarizeStatuses,
  type ChecklistFinding,
} from './checklist'
import {
  GitHubHttpError,
  classifyVersionUpdate,
  fetchGitHubJson,
  fetchNpmLatestVersion,
  statusForPackageUpdate,
} from './github'
import { resolveGitHubToken } from './tokenSource'

type GitHubRepository = {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  default_branch: string
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
  updateType: 'none' | 'patch' | 'minor' | 'major' | 'unknown'
  status: HealthStatus
}

export const listRepositories = queryGeneric({
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

export const listRepositoryDashboard = queryGeneric({
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

export const createScanRun = mutationGeneric({
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

export const finalizeScanRun = mutationGeneric({
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

export const upsertRepositories = mutationGeneric({
  args: {
    connectionId: v.id('githubConnections'),
    repositories: v.array(
      v.object({
        githubId: v.number(),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        visibility: v.union(v.literal('public'), v.literal('private')),
        defaultBranch: v.string(),
        htmlUrl: v.string(),
        pushedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const idsByFullName: Record<string, string> = {}

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
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
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
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          htmlUrl: repo.htmlUrl,
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

export const saveRepositoryScanResult = mutationGeneric({
  args: {
    repositoryId: v.id('repositories'),
    scanRunId: v.id('scanRuns'),
    hasPackageJson: v.boolean(),
    packageFindings: v.array(
      v.object({
        packageName: v.string(),
        currentVersion: v.string(),
        latestVersion: v.string(),
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
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.repositoryId, {
      hasPackageJson: args.hasPackageJson,
      lastScanAt: now,
      lastScanRunId: args.scanRunId,
      lastScanStatus: args.repositoryStatus,
      lastScanError: args.repositoryError,
      updatedAt: now,
    })

    for (const finding of args.packageFindings) {
      await ctx.db.insert('packageFindings', {
        repositoryId: args.repositoryId,
        scanRunId: args.scanRunId,
        packageName: finding.packageName,
        currentVersion: finding.currentVersion,
        latestVersion: finding.latestVersion,
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

export const triggerScanAll = mutationGeneric({
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
      return { ok: false, message: 'GitHub connection not found' } as const
    }

    if (connection.status !== 'connected') {
      return { ok: false, message: 'GitHub connection is not valid' } as const
    }

    await ctx.scheduler.runAfter(0, anyApi.scans.scanAllRepositories, {
      connectionKey: args.connectionKey ?? DEFAULT_CONNECTION_KEY,
      scope: 'all',
    })

    return { ok: true } as const
  },
})

export const triggerScanSingleRepository = mutationGeneric({
  args: {
    repositoryId: v.id('repositories'),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, anyApi.scans.scanSingleRepository, {
      repositoryId: args.repositoryId,
    })
    return { ok: true } as const
  },
})

export const runScheduledScan = actionGeneric({
  args: {},
  handler: async (ctx) => {
    return await ctx.runAction(anyApi.scans.scanAllRepositories, {
      connectionKey: DEFAULT_CONNECTION_KEY,
      scope: 'scheduled',
    })
  },
})

export const scanSingleRepository = actionGeneric({
  args: {
    repositoryId: v.id('repositories'),
  },
  handler: async (ctx, args) => {
    const repository = await ctx.runQuery(anyApi.scans.listRepositories, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    const target = repository.find((repo) => repo._id === args.repositoryId)
    if (!target) {
      return { ok: false, message: 'Repository not found' } as const
    }

    const connection = await ctx.runQuery(anyApi.githubConnections.getConnectionForScanner, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    if (!connection || connection.status !== 'connected') {
      return { ok: false, message: 'GitHub connection is not ready' } as const
    }
    const connectionToken = resolveGitHubToken(connection)
    if (!connectionToken) {
      return { ok: false, message: 'OAuth token source is not implemented yet' } as const
    }

    const scanRunId = await ctx.runMutation(anyApi.scans.createScanRun, {
      connectionId: connection._id,
      scope: 'single',
      repositoryId: target._id,
    })

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
          default_branch: target.defaultBranch,
          pushed_at: target.pushedAt ? new Date(target.pushedAt).toISOString() : '',
        },
        repositoryId: target._id,
        scanRunId,
      })

      await ctx.runMutation(anyApi.scans.finalizeScanRun, {
        scanRunId,
        status: 'completed',
        scannedCount: 1,
        successCount: 1,
        failedCount: 0,
      })
      return { ok: true } as const
    } catch (error) {
      await ctx.runMutation(anyApi.scans.finalizeScanRun, {
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

export const scanAllRepositories = actionGeneric({
  args: {
    connectionKey: v.optional(v.string()),
    scope: v.optional(v.union(v.literal('all'), v.literal('scheduled'))),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(anyApi.githubConnections.getConnectionForScanner, {
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

    const scanRunId = await ctx.runMutation(anyApi.scans.createScanRun, {
      connectionId: connection._id,
      scope: args.scope ?? 'all',
    })

    try {
      const reposFromGitHub = await fetchAllRepositories(connectionToken)
      const repoMap = await ctx.runMutation(anyApi.scans.upsertRepositories, {
        connectionId: connection._id,
        repositories: reposFromGitHub.map((repo) => ({
          githubId: repo.id,
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          visibility: repo.private ? 'private' : 'public',
          defaultBranch: repo.default_branch,
          htmlUrl: repo.html_url,
          pushedAt: repo.pushed_at ? new Date(repo.pushed_at).getTime() : undefined,
        })),
      })

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
          await ctx.runMutation(anyApi.scans.saveRepositoryScanResult, {
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

      await ctx.runMutation(anyApi.scans.finalizeScanRun, {
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
      await ctx.runMutation(anyApi.scans.finalizeScanRun, {
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
  ctx: {
    runMutation: (reference: unknown, args: unknown) => Promise<unknown>
  },
  args: {
    connectionToken: string
    packagePolicy: PackagePolicy | undefined
    repository: GitHubRepository
    repositoryId: string
    scanRunId: string
  }
) {
  const packageJsonResult = await fetchPackageJson(args.connectionToken, args.repository)

  const packageFindings: PackageFinding[] = []
  if (packageJsonResult.ok) {
    const dependencies = {
      ...(packageJsonResult.packageJson.dependencies ?? {}),
      ...(packageJsonResult.packageJson.devDependencies ?? {}),
    }

    for (const [packageName, currentVersion] of Object.entries(dependencies)) {
      const latestVersion = await fetchNpmLatestVersion(packageName)
      const normalizedLatest = latestVersion ?? currentVersion
      const updateType = latestVersion
        ? classifyVersionUpdate(currentVersion, latestVersion)
        : 'unknown'

      packageFindings.push({
        packageName,
        currentVersion,
        latestVersion: normalizedLatest,
        updateType,
        status: statusForPackageUpdate(updateType, args.packagePolicy ?? DEFAULT_PACKAGE_POLICY),
      })
    }
  }

  const checklistFindings = await evaluateChecklist(
    args.connectionToken,
    args.repository,
    packageJsonResult.ok ? packageJsonResult.packageJson : null
  )

  const combinedStatuses = [
    ...packageFindings.map((finding) => finding.status),
    ...checklistFindings.map((finding) => finding.status),
  ]
  const repositoryStatus = summarizeStatuses(combinedStatuses)

  await ctx.runMutation(anyApi.scans.saveRepositoryScanResult, {
    repositoryId: args.repositoryId,
    scanRunId: args.scanRunId,
    hasPackageJson: packageJsonResult.ok,
    packageFindings,
    checklistFindings,
    repositoryStatus,
    repositoryError: packageJsonResult.ok ? undefined : packageJsonResult.error,
  })
}

async function fetchPackageJson(token: string, repository: GitHubRepository) {
  try {
    const payload = await fetchGitHubJson<GitHubContentResponse>(
      `/repos/${repository.owner.login}/${repository.name}/contents/package.json?ref=${repository.default_branch}`,
      { token }
    )

    if (payload.type !== 'file' || !payload.content) {
      return { ok: false, error: 'package.json not found' } as const
    }

    const decoded = decodeBase64(payload.content, payload.encoding ?? 'base64')
    const packageJson = JSON.parse(decoded) as {
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

  findings.push({
    checkKey: 'dependabot-config',
    status: dependabotExists ? 'ok' : 'missing',
    detail: dependabotExists ? 'Dependabot config file found' : 'Dependabot config file missing',
  })

  return findings
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

function decodeBase64(content: string, encoding: string) {
  if (encoding !== 'base64') {
    return content
  }
  const binary = atob(content.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
