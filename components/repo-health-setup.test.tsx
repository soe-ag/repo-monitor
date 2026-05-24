import { fireEvent, render, screen } from '@testing-library/react'
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
})
