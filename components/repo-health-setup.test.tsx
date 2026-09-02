import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
              packageManager: 'pnpm',
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
    expect(screen.getByText('pnpm')).toHaveClass('bg-sky-100', 'dark:bg-sky-900')
    expect(screen.getByText(/Eligible updates:/)).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === 'Checklist: 1 passed / 0 failed')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Open details (All good)')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open details (All good)'))

    expect(
      await screen.findByText(/Package update findings and checklist details/)
    ).toBeInTheDocument()
    expect(screen.getByText(/react/)).toBeInTheDocument()
    expect(screen.getByText(/Dependabot config file missing/)).toBeInTheDocument()
  })

  it('filters repository cards with debounced custom filters', async () => {
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
              _id: 'repo-npm',
              fullName: 'acme/npm-repo',
              visibility: 'public',
              packageManager: 'npm',
              githubUpdatedAt: 1767225600000,
              packageFindings: [],
              checklistFindings: [],
            },
            {
              _id: 'repo-pnpm',
              fullName: 'acme/pnpm-repo',
              visibility: 'private',
              packageManager: 'pnpm',
              githubUpdatedAt: 1767225600000,
              packageFindings: [],
              checklistFindings: [],
            },
          ])
        }
        return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
      })
    )

    render(<RepoHealthSetup />)

    expect(await screen.findByText('npm-repo')).toBeInTheDocument()
    expect(screen.getByText('pnpm-repo')).toBeInTheDocument()
    expect(screen.getByText('npm')).toHaveClass('bg-orange-100', 'dark:bg-orange-900')
    expect(screen.getByText('pnpm')).toHaveClass('bg-sky-100', 'dark:bg-sky-900')

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.click(screen.getByLabelText('npm'))
    await waitFor(() => {
      expect(screen.getByText('npm-repo')).toBeInTheDocument()
      expect(screen.queryByText('pnpm-repo')).not.toBeInTheDocument()
    })
  })

  it('excludes package-only warnings from the needs-attention filter', async () => {
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
              checklistFindings: [],
            },
          ])
        }
        return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
      })
    )

    render(<RepoHealthSetup />)
    expect(await screen.findByText('repo-monitor')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.click(screen.getByLabelText('Needs attention'))

    await waitFor(() => {
      expect(screen.getByText('No repositories match the current filter.')).toBeInTheDocument()
    })
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

    fireEvent.click(screen.getByRole('button', { name: 'Select last 10' }))
    expect(screen.getByText('Selected: 10/10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Scan selected' }))

    expect(
      await screen.findByText('Scan all queued for 10 repositories. Watching updates...')
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scan selected' })).toBeEnabled()
    })

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/api/scans') && init?.method === 'POST'
    )

    expect(postCall).toBeDefined()

    const body = JSON.parse(String(postCall?.[1]?.body)) as { repositoryIds: string[] }
    expect(body.repositoryIds).toHaveLength(10)
  })

  it('refreshes the repository list from GitHub on demand', async () => {
    let repositoryLoads = 0
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

      if (url.endsWith('/api/repositories') && init?.method === 'PUT') {
        return mockJsonResponse({ ok: true, repositoryCount: 2 })
      }

      if (url.endsWith('/api/scans') && !init?.method) {
        repositoryLoads += 1
        const repositories = [
          {
            _id: 'repo-1',
            fullName: 'acme/existing-repo',
            visibility: 'private' as const,
            githubCreatedAt: 1735689600000,
            githubUpdatedAt: 1767225600000,
            packageFindings: [],
            checklistFindings: [],
          },
        ]
        if (repositoryLoads > 1) {
          repositories.push({
            _id: 'repo-2',
            fullName: 'acme/new-repo',
            visibility: 'private',
            githubCreatedAt: 1735689600001,
            githubUpdatedAt: 1767225600001,
            packageFindings: [],
            checklistFindings: [],
          })
        }
        return mockJsonResponse(repositories)
      }

      return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<RepoHealthSetup />)
    expect(await screen.findByText('existing-repo')).toBeInTheDocument()
    expect(screen.queryByText('new-repo')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh repositories' }))

    expect(await screen.findByText('new-repo')).toBeInTheDocument()
    expect(screen.getByText('Repository list refreshed. 2 repositories found.')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).endsWith('/api/repositories') && init?.method === 'PUT'
      )
    ).toBe(true)
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

    await waitFor(() => {
      const pollCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/api/scans?repositoryId=')
      )
      expect(pollCall).toBeDefined()
    })
  })

  it('shows only packages that need updates in detail modal', async () => {
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
              packageFindings: [
                {
                  _id: 'pkg-1',
                  packageName: 'react',
                  currentVersion: '19.0.0',
                  latestVersion: '19.2.4',
                  updateType: 'minor',
                  status: 'warning',
                },
                {
                  _id: 'pkg-2',
                  packageName: 'zod',
                  currentVersion: '4.4.3',
                  latestVersion: '4.4.3',
                  updateType: 'none',
                  status: 'ok',
                },
              ],
              checklistFindings: [],
            },
          ])
        }
        return mockJsonResponse({ error: `Unhandled endpoint ${url}` })
      })
    )

    render(<RepoHealthSetup />)
    expect(await screen.findByText('repo-monitor')).toBeInTheDocument()

    expect(screen.getByLabelText('Open details (All good)')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open details (All good)'))

    expect(await screen.findByText(/react/)).toBeInTheDocument()
    expect(screen.queryByText(/zod/)).not.toBeInTheDocument()
  })
})
