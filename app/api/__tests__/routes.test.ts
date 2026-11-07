import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  action: vi.fn(),
}))

vi.mock('@/lib/convexHttp', () => ({ getConvexHttpClient: () => client }))

import { PATCH, POST as connect } from '../github-connection/route'
import { POST as scan } from '../scans/route'

const post = (body: unknown, raw = false) =>
  new Request('http://localhost/api', {
    method: 'POST',
    body: raw ? (body as string) : JSON.stringify(body),
  })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/scans', () => {
  it('rejects malformed JSON with 400', async () => {
    const res = await scan(post('{nope', true))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/valid JSON/)
  })

  it('rejects an unknown mode', async () => {
    const res = await scan(post({ mode: 'weekly' }))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/Invalid scan mode/)
  })

  it('requires repositoryId for a single scan', async () => {
    const res = await scan(post({ mode: 'single' }))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/requires a repositoryId/)
  })

  it('rejects more than 10 selected repositories', async () => {
    const repositoryIds = Array.from({ length: 11 }, (_, i) => `r${i}`)
    const res = await scan(post({ mode: 'all', repositoryIds }))
    expect(res.status).toBe(400)
    expect(client.mutation).not.toHaveBeenCalled()
  })

  it('triggers a single scan', async () => {
    client.mutation.mockResolvedValue({ ok: true })
    const res = await scan(post({ mode: 'single', repositoryId: 'repo1' }))
    expect(res.status).toBe(200)
    expect(client.mutation).toHaveBeenCalledWith(expect.anything(), { repositoryId: 'repo1' })
  })

  it('triggers a selected scan', async () => {
    client.mutation.mockResolvedValue({ ok: true })
    const res = await scan(post({ mode: 'all', repositoryIds: ['a', 'b'] }))
    expect(res.status).toBe(200)
    expect(client.mutation).toHaveBeenCalledWith(expect.anything(), {
      connectionKey: 'default',
      repositoryIds: ['a', 'b'],
    })
  })

  it('returns a generic 500 and does not leak the internal error', async () => {
    client.mutation.mockRejectedValue(new Error('secret internal detail'))
    const res = await scan(post({ mode: 'single', repositoryId: 'repo1' }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('secret internal detail')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('/api/github-connection', () => {
  it('requires a PAT', async () => {
    const res = await connect(post({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('PAT is required')
    expect(client.action).not.toHaveBeenCalled()
  })

  it('rejects an invalid package policy', async () => {
    const res = await connect(post({ pat: 'ghp_x', packagePolicy: 'yolo' }))
    expect(res.status).toBe(400)
  })

  it('passes a valid PAT to Convex', async () => {
    client.action.mockResolvedValue({ ok: true })
    const res = await connect(post({ pat: 'ghp_x', packagePolicy: 'major-only' }))
    expect(res.status).toBe(200)
    expect(client.action).toHaveBeenCalledWith(expect.anything(), {
      pat: 'ghp_x',
      connectionKey: 'default',
      packagePolicy: 'major-only',
    })
  })

  it('PATCH rejects a missing package policy', async () => {
    const res = await PATCH(post({}))
    expect(res.status).toBe(400)
  })
})
