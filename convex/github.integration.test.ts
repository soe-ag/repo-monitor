import { describe, expect, it, vi } from 'vitest'
import { fetchGitHubJson, validatePat } from './github'

describe('github API ingestion', () => {
  it('fetchGitHubJson returns parsed payload for successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }))
    )

    const payload = await fetchGitHubJson<{ login: string }>('/user', { token: 'token' })
    expect(payload.login).toBe('octocat')
  })

  it('validatePat returns invalid for unauthorized token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 }))
    )

    const result = await validatePat('bad-token')
    expect(result).toMatchObject({
      status: 'invalid',
      error: 'Invalid GitHub personal access token',
    })
  })

  it('validatePat returns rate-limited state when reset header exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('', {
            status: 403,
            headers: { 'x-ratelimit-reset': '1700000000' },
          })
      )
    )

    const result = await validatePat('limited-token')
    expect(result).toMatchObject({
      status: 'rate-limited',
      rateLimitResetAt: 1700000000 * 1000,
    })
  })
})
