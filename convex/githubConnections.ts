import { anyApi, mutationGeneric, queryGeneric, actionGeneric } from 'convex/server'
import { v } from 'convex/values'
import { DEFAULT_CONNECTION_KEY, DEFAULT_PACKAGE_POLICY, PACKAGE_POLICIES } from './constants'
import { validatePat } from './github'
import { resolveGitHubToken } from './tokenSource'

export const getConnectionState = queryGeneric({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = args.connectionKey ?? DEFAULT_CONNECTION_KEY
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', key))
      .first()

    if (!connection) {
      return {
        status: 'invalid',
        connected: false,
        message: 'No GitHub connection configured',
      } as const
    }

    return {
      status: connection.status,
      connected: connection.status === 'connected',
      packagePolicy: connection.packagePolicy,
      rateLimitResetAt: connection.rateLimitResetAt,
      lastValidatedAt: connection.lastValidatedAt,
      lastError: connection.lastError,
      accountLogin: connection.accountLogin,
      accountName: connection.accountName,
      accountAvatarUrl: connection.accountAvatarUrl,
      accountHtmlUrl: connection.accountHtmlUrl,
    } as const
  },
})

export const getConnectionForScanner = queryGeneric({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = args.connectionKey ?? DEFAULT_CONNECTION_KEY
    const connection = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', key))
      .first()

    return connection
  },
})

export const saveConnection = mutationGeneric({
  args: {
    connectionKey: v.string(),
    token: v.string(),
    tokenSource: v.union(v.literal('pat'), v.literal('oauth')),
    status: v.union(v.literal('connected'), v.literal('invalid'), v.literal('rate-limited')),
    packagePolicy: v.union(
      v.literal('any-newer'),
      v.literal('minor-or-major'),
      v.literal('major-only')
    ),
    accountLogin: v.optional(v.string()),
    accountName: v.optional(v.string()),
    accountAvatarUrl: v.optional(v.string()),
    accountHtmlUrl: v.optional(v.string()),
    rateLimitResetAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', args.connectionKey))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token,
        tokenSource: args.tokenSource,
        status: args.status,
        packagePolicy: args.packagePolicy,
        accountLogin: args.accountLogin,
        accountName: args.accountName,
        accountAvatarUrl: args.accountAvatarUrl,
        accountHtmlUrl: args.accountHtmlUrl,
        lastValidatedAt: now,
        rateLimitResetAt: args.rateLimitResetAt,
        lastError: args.lastError,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('githubConnections', {
      connectionKey: args.connectionKey,
      token: args.token,
      tokenSource: args.tokenSource,
      status: args.status,
      packagePolicy: args.packagePolicy,
      accountLogin: args.accountLogin,
      accountName: args.accountName,
      accountAvatarUrl: args.accountAvatarUrl,
      accountHtmlUrl: args.accountHtmlUrl,
      lastValidatedAt: now,
      rateLimitResetAt: args.rateLimitResetAt,
      lastError: args.lastError,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updatePackagePolicy = mutationGeneric({
  args: {
    connectionKey: v.optional(v.string()),
    packagePolicy: v.union(
      v.literal('any-newer'),
      v.literal('minor-or-major'),
      v.literal('major-only')
    ),
  },
  handler: async (ctx, args) => {
    const key = args.connectionKey ?? DEFAULT_CONNECTION_KEY
    const existing = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', key))
      .first()

    if (!existing) {
      return { ok: false, message: 'Connection not found' } as const
    }

    await ctx.db.patch(existing._id, {
      packagePolicy: args.packagePolicy,
      updatedAt: Date.now(),
    })

    return { ok: true } as const
  },
})

export const deleteConnection = mutationGeneric({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = args.connectionKey ?? DEFAULT_CONNECTION_KEY
    const existing = await ctx.db
      .query('githubConnections')
      .withIndex('by_connection_key', (q) => q.eq('connectionKey', key))
      .first()

    if (!existing) {
      return { ok: true } as const
    }

    await ctx.db.delete(existing._id)
    return { ok: true } as const
  },
})

export const refreshConnectionProfile = actionGeneric({
  args: {
    connectionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(anyApi.githubConnections.getConnectionForScanner, {
      connectionKey: args.connectionKey ?? DEFAULT_CONNECTION_KEY,
    })

    if (!connection) {
      return { ok: false, message: 'Connection not found' } as const
    }

    const token = resolveGitHubToken(connection)
    if (!token) {
      return { ok: false, message: 'OAuth token source is not implemented yet' } as const
    }

    const validation = await validatePat(token)
    await ctx.runMutation(anyApi.githubConnections.saveConnection, {
      connectionKey: connection.connectionKey,
      token,
      tokenSource: connection.tokenSource,
      status: validation.status,
      packagePolicy: connection.packagePolicy,
      accountLogin: validation.login,
      accountName: validation.name,
      accountAvatarUrl: validation.avatarUrl,
      accountHtmlUrl: validation.htmlUrl,
      rateLimitResetAt: validation.rateLimitResetAt,
      lastError: validation.error,
    })

    return {
      ok: validation.status === 'connected',
      status: validation.status,
      message: validation.error,
    } as const
  },
})

export const connectWithPat = actionGeneric({
  args: {
    pat: v.string(),
    connectionKey: v.optional(v.string()),
    packagePolicy: v.optional(
      v.union(v.literal('any-newer'), v.literal('minor-or-major'), v.literal('major-only'))
    ),
  },
  handler: async (ctx, args) => {
    const connectionKey = args.connectionKey ?? DEFAULT_CONNECTION_KEY
    const packagePolicy = args.packagePolicy ?? DEFAULT_PACKAGE_POLICY
    if (!PACKAGE_POLICIES.includes(packagePolicy)) {
      return { ok: false, message: 'Invalid package policy' } as const
    }

    const validation = await validatePat(args.pat)
    await ctx.runMutation(anyApi.githubConnections.saveConnection, {
      connectionKey,
      token: args.pat,
      tokenSource: 'pat',
      status: validation.status,
      packagePolicy,
      accountLogin: validation.login,
      accountName: validation.name,
      accountAvatarUrl: validation.avatarUrl,
      accountHtmlUrl: validation.htmlUrl,
      rateLimitResetAt: validation.rateLimitResetAt,
      lastError: validation.error,
    })

    return {
      ok: validation.status === 'connected',
      status: validation.status,
      login: validation.login,
      rateLimitResetAt: validation.rateLimitResetAt,
      error: validation.error,
    } as const
  },
})
