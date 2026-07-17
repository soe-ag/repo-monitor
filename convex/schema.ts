import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  githubConnections: defineTable({
    connectionKey: v.string(),
    tokenSource: v.union(v.literal('pat'), v.literal('oauth')),
    token: v.string(),
    status: v.union(v.literal('connected'), v.literal('invalid'), v.literal('rate-limited')),
    packagePolicy: v.union(
      v.literal('any-newer'),
      v.literal('minor-or-major'),
      v.literal('major-only')
    ),
    lastValidatedAt: v.optional(v.number()),
    rateLimitResetAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    accountLogin: v.optional(v.string()),
    accountName: v.optional(v.string()),
    accountAvatarUrl: v.optional(v.string()),
    accountHtmlUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_connection_key', ['connectionKey']),

  repositories: defineTable({
    connectionId: v.id('githubConnections'),
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
    hasPackageJson: v.optional(v.boolean()),
    lastScanAt: v.optional(v.number()),
    lastScanRunId: v.optional(v.id('scanRuns')),
    lastScanStatus: v.optional(
      v.union(
        v.literal('ok'),
        v.literal('warning'),
        v.literal('missing'),
        v.literal('stale'),
        v.literal('error'),
        v.literal('unknown')
      )
    ),
    lastScanError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_connection', ['connectionId'])
    .index('by_connection_full_name', ['connectionId', 'fullName']),

  packageFindings: defineTable({
    repositoryId: v.id('repositories'),
    scanRunId: v.id('scanRuns'),
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
    createdAt: v.number(),
  }).index('by_repository_and_scan', ['repositoryId', 'scanRunId']),

  checklistFindings: defineTable({
    repositoryId: v.id('repositories'),
    scanRunId: v.id('scanRuns'),
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
    checkedAt: v.number(),
  }).index('by_repository_and_scan', ['repositoryId', 'scanRunId']),

  scanRuns: defineTable({
    connectionId: v.id('githubConnections'),
    scope: v.union(v.literal('all'), v.literal('single'), v.literal('scheduled')),
    status: v.union(
      v.literal('running'),
      v.literal('completed'),
      v.literal('partial'),
      v.literal('failed')
    ),
    repositoryId: v.optional(v.id('repositories')),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    scannedCount: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    errorSummary: v.optional(v.string()),
  }).index('by_connection_and_started_at', ['connectionId', 'startedAt']),
})
