import { describe, expect, it } from 'vitest'
import { PACKAGE_UPDATE_MINIMUM_AGE_MS } from './constants'
import {
  classifyVersionUpdate,
  statusForPackageUpdate,
  summarizeDeployments,
  summarizeLatestCommitBuild,
} from './github'

describe('classifyVersionUpdate', () => {
  it('detects patch, minor, major, none, and unknown changes', () => {
    expect(classifyVersionUpdate('1.2.3', '1.2.4')).toBe('patch')
    expect(classifyVersionUpdate('1.2.3', '1.3.0')).toBe('minor')
    expect(classifyVersionUpdate('1.2.3', '2.0.0')).toBe('major')
    expect(classifyVersionUpdate('1.2.3', '1.2.3')).toBe('none')
    expect(classifyVersionUpdate('workspace:*', '2.0.0')).toBe('unknown')
  })
})

describe('summarizeLatestCommitBuild', () => {
  it('returns only completed passing or failing results', () => {
    expect(summarizeLatestCommitBuild([], { state: 'failure' })?.status).toBe('failing')
    expect(summarizeLatestCommitBuild([], { state: 'success' })?.status).toBe('passing')
    expect(
      summarizeLatestCommitBuild([{ status: 'completed', conclusion: 'failure' }])?.status
    ).toBe('failing')
  })

  it('keeps the previous result when the current build is running or unavailable', () => {
    expect(summarizeLatestCommitBuild([], { state: 'pending' })).toBeNull()
    expect(summarizeLatestCommitBuild([{ status: 'in_progress' }])).toBeNull()
    expect(summarizeLatestCommitBuild([])).toBeNull()
  })
})

describe('summarizeDeployments', () => {
  it('reports an active successful deployment', () => {
    expect(
      summarizeDeployments([
        {
          deployment: { id: 1, environment: 'Production' },
          latestStatus: {
            state: 'success',
            environment_url: 'https://example.com',
          },
        },
      ])
    ).toMatchObject({
      status: 'deployed',
      environment: 'Production',
      url: 'https://example.com',
    })
  })

  it('keeps a repository deployed while a newer deployment is running', () => {
    expect(
      summarizeDeployments([
        {
          deployment: { id: 2, environment: 'Production' },
          latestStatus: { state: 'in_progress' },
        },
        {
          deployment: { id: 1, environment: 'Production' },
          latestStatus: { state: 'success' },
        },
      ])?.status
    ).toBe('deployed')
  })

  it('keeps a repository deployed when an older successful deployment remains active', () => {
    expect(
      summarizeDeployments([
        {
          deployment: { id: 2, environment: 'Production' },
          latestStatus: { state: 'failure' },
        },
        {
          deployment: { id: 1, environment: 'Production' },
          latestStatus: { state: 'success' },
        },
      ])?.status
    ).toBe('deployed')
  })

  it('reports no active deployment only when GitHub has a completed deployment record', () => {
    expect(
      summarizeDeployments([
        {
          deployment: { id: 1, environment: 'Production' },
          latestStatus: { state: 'failure' },
        },
      ])?.status
    ).toBe('not-deployed')
    expect(summarizeDeployments([])).toBeNull()
    expect(
      summarizeDeployments([{ deployment: { id: 1 }, latestStatus: { state: 'in_progress' } }])
    ).toBeNull()
  })
})

describe('statusForPackageUpdate', () => {
  it('ignores patch noise and waits for mature minor and major releases', () => {
    const now = 1_000_000_000_000
    const matureRelease = now - PACKAGE_UPDATE_MINIMUM_AGE_MS - 1
    const freshRelease = now - PACKAGE_UPDATE_MINIMUM_AGE_MS + 1

    expect(statusForPackageUpdate('patch', 'any-newer', matureRelease, now)).toBe('ok')
    expect(statusForPackageUpdate('minor', 'minor-or-major', matureRelease, now)).toBe('warning')
    expect(statusForPackageUpdate('minor', 'minor-or-major', freshRelease, now)).toBe('ok')
    expect(statusForPackageUpdate('major', 'major-only', matureRelease, now)).toBe('warning')
    expect(statusForPackageUpdate('major', 'major-only', freshRelease, now)).toBe('ok')
    expect(statusForPackageUpdate('unknown', 'major-only', matureRelease, now)).toBe('unknown')
  })
})
