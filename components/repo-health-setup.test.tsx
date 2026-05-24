import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepoHealthSetup } from './repo-health-setup'

function mockJsonResponse(body: unknown) {
  return Promise.resolve({
    json: async () => body,
  } as Response)
}

describe('RepoHealthSetup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders repository card details and status indicators', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.startsWith('https://api.svgl.app')) {
          return mockJsonResponse([])
        }
        if (url.endsWith('/api/github-connection')) {
          return mockJsonResponse({
            status: 'connected',
            connected: true,
            packagePolicy: 'any-newer',
            lastValidatedAt: 1700000000000,
            accountLogin: 'acme',
          })
        }

        if (url.endsWith('/api/scans')) {
          return mockJsonResponse([
            {
              _id: 'repo-1',
              fullName: 'acme/repo-monitor',
              visibility: 'private',
              githubCreatedAt: 1735689600000,
              githubUpdatedAt: 1767225600000,
              lastScanAt: 1767225600000,
              lastScanStatus: 'warning',
              packageFindings: [
                {
                  _id: 'pkg-1',
                  packageName: 'react',
                  currentVersion: '19.0.0',
                  latestVersion: '19.2.4',
                  updateType: 'minor',
                  status: 'warning',
                },
              ],
              checklistFindings: [
                {
                  _id: 'chk-1',
                  checkKey: 'tests-configured',
                  status: 'ok',
                  detail: 'Test script detected: vitest run',
                },
                {
                  _id: 'chk-2',
                  checkKey: 'dependabot-config',
                  status: 'missing',
                  detail: 'Dependabot config file missing',
                },
              ],
            },
          ])
        }

        return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
      })
    )

    render(<RepoHealthSetup />)

    expect(await screen.findByText('repo-monitor')).toBeInTheDocument()
    expect(screen.getByText(/Outdated packages:/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByLabelText('Open details')[0])

    expect(
      await screen.findByText(/Package update findings and checklist details/)
    ).toBeInTheDocument()
    expect(screen.getByText(/react/)).toBeInTheDocument()
    expect(screen.getByText(/Dependabot config file missing/)).toBeInTheDocument()
  })

  it('renders only all and needs-attention filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.startsWith('https://api.svgl.app')) {
          return mockJsonResponse([])
        }
        if (url.endsWith('/api/github-connection')) {
          return mockJsonResponse({
            status: 'connected',
            connected: true,
            packagePolicy: 'any-newer',
            accountLogin: 'acme',
          })
        }
        if (url.endsWith('/api/scans')) {
          return mockJsonResponse([
            {
              _id: 'repo-1',
              fullName: 'acme/repo-monitor',
              visibility: 'private',
              githubCreatedAt: 1735689600000,
              githubUpdatedAt: 1767225600000,
              lastScanAt: 1767225600000,
              lastScanStatus: 'warning',
              packageFindings: [],
              checklistFindings: [],
            },
          ])
        }
        return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
      })
    )

    render(<RepoHealthSetup />)
    expect(await screen.findByText('repo-monitor')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Needs attention/ }))

    expect(screen.queryByRole('button', { name: /Healthy/ })).not.toBeInTheDocument()
  })

  it('caps scan all selection and request payload to 10 repositories', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://api.svgl.app')) {
        return mockJsonResponse([])
      }

      if (url.endsWith('/api/github-connection')) {
        return mockJsonResponse({
          status: 'connected',
          connected: true,
          packagePolicy: 'any-newer',
          accountLogin: 'acme',
        })
      }

      if (url.endsWith('/api/scans') && !init?.method) {
        return mockJsonResponse(
          Array.from({ length: 12 }, (_, index) => ({
            _id: `repo-${index + 1}`,
            fullName: `acme/repo-${index + 1}`,
            visibility: 'private',
            githubCreatedAt: 1735689600000 + index,
            githubUpdatedAt: 1767225600000 + index,
            lastScanAt: 1767225600000 + index,
            lastScanStatus: 'ok',
            packageFindings: [],
            checklistFindings: [],
          }))
        )
      }

      if (url.endsWith('/api/scans') && init?.method === 'POST') {
        return mockJsonResponse({ ok: true })
      }

      return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<RepoHealthSetup />)

    expect(await screen.findByText('repo-1')).toBeInTheDocument()
    expect(screen.getByText('Selected: 0/10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select last 10 repos' }))
    expect(screen.getByText('Selected: 10/10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Scan selected repos' }))

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/scans') && init?.method === 'POST'
    )

    expect(postCall).toBeDefined()

    const body = JSON.parse(String(postCall?.[1]?.body)) as { repositoryIds: string[] }
    expect(body.repositoryIds).toHaveLength(10)
  })

  it('clicking a repository scan button triggers single scan only', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://api.svgl.app')) {
        return mockJsonResponse([])
      }

      if (url.endsWith('/api/github-connection')) {
        return mockJsonResponse({
          status: 'connected',
          connected: true,
          packagePolicy: 'any-newer',
          accountLogin: 'acme',
        })
      }

      if (url.endsWith('/api/scans') && !init?.method) {
        return mockJsonResponse([
          {
            _id: 'repo-1',
            fullName: 'acme/repo-1',
            visibility: 'private',
            githubCreatedAt: 1735689600000,
            githubUpdatedAt: 1767225600000,
            lastScanAt: 1767225600000,
            lastScanStatus: 'ok',
            packageFindings: [],
            checklistFindings: [],
          },
          {
            _id: 'repo-2',
            fullName: 'acme/repo-2',
            visibility: 'private',
            githubCreatedAt: 1735689600001,
            githubUpdatedAt: 1767225600001,
            lastScanAt: 1767225600001,
            lastScanStatus: 'ok',
            packageFindings: [],
            checklistFindings: [],
          },
        ])
      }

      if (url.endsWith('/api/scans') && init?.method === 'POST') {
        return mockJsonResponse({ ok: true })
      }

      return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<RepoHealthSetup />)
    expect(await screen.findByText('repo-1')).toBeInTheDocument()

    const repoCardTitle = screen.getByText('repo-1')
    const repoCard = repoCardTitle.closest('[class*="h-full"]')
    expect(repoCard).not.toBeNull()
    fireEvent.click(within(repoCard as HTMLElement).getByLabelText('Scan repository'))

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/scans') && init?.method === 'POST'
    )
    expect(postCall).toBeDefined()

    const body = JSON.parse(String(postCall?.[1]?.body)) as {
      mode: string
      repositoryId?: string
      repositoryIds?: string[]
    }

    expect(body.mode).toBe('single')
    expect(body.repositoryId).toBe('repo-1')
    expect(body.repositoryIds).toBeUndefined()

    const pollCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/scans?repositoryId=')
    )
    expect(pollCall).toBeUndefined()
  })
})
