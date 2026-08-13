import { describe, expect, it } from 'vitest'
import {
  getEligiblePackageUpdates,
  getRepositoryDisplayName,
  getRequiredChecklistFailures,
  getStackLogos,
  hasRequiredChecklistAttention,
  isRepositoryHealthy,
  normalizeSvglRoute,
  type RepositoryHealthCard,
} from './repo-health-model'

function makeRepository(overrides: Partial<RepositoryHealthCard> = {}): RepositoryHealthCard {
  return {
    _id: 'repo-1',
    _creationTime: 1,
    fullName: 'acme/repo-monitor',
    htmlUrl: 'https://github.com/acme/repo-monitor',
    defaultBranch: 'main',
    visibility: 'private',
    packageFindings: [],
    checklistFindings: [],
    ...overrides,
  }
}

describe('repository health model', () => {
  it('ignores optional checklist findings when calculating repository health', () => {
    const repository = makeRepository({
      lastScanAt: 10,
      checklistFindings: [
        {
          _id: 'finding-1',
          checkKey: 'dependabot-config',
          status: 'missing',
        },
      ],
    })

    expect(hasRequiredChecklistAttention(repository)).toBe(false)
    expect(getRequiredChecklistFailures(repository)).toEqual([])
    expect(isRepositoryHealthy(repository)).toBe(true)
  })

  it('combines build, deployment, and required checklist failures', () => {
    const repository = makeRepository({
      lastScanAt: 10,
      latestCommitBuildStatus: 'failing',
      checklistFindings: [{ _id: 'finding-1', checkKey: 'tests-configured', status: 'warning' }],
    })

    expect(hasRequiredChecklistAttention(repository)).toBe(true)
    expect(getRequiredChecklistFailures(repository)).toHaveLength(1)
    expect(isRepositoryHealthy(repository)).toBe(false)
  })

  it('returns only packages with eligible updates', () => {
    const repository = makeRepository({
      packageFindings: [
        {
          _id: 'react',
          packageName: 'react',
          currentVersion: '19.0.0',
          latestVersion: '19.2.0',
          updateType: 'minor',
          status: 'warning',
        },
        {
          _id: 'zod',
          packageName: 'zod',
          currentVersion: '4.0.0',
          latestVersion: '4.0.0',
          updateType: 'none',
          status: 'ok',
        },
      ],
    })

    expect(getEligiblePackageUpdates(repository).map((finding) => finding.packageName)).toEqual([
      'react',
    ])
  })

  it('normalizes display names, stack aliases, and logo routes', () => {
    const repository = makeRepository({
      primaryLanguage: 'TypeScript',
      packageFindings: [
        {
          _id: 'next',
          packageName: 'next',
          currentVersion: '16.0.0',
          latestVersion: '16.0.0',
          updateType: 'none',
          status: 'ok',
        },
      ],
    })

    expect(getRepositoryDisplayName(repository.fullName)).toBe('repo-monitor')
    expect(
      getStackLogos(repository, {
        typescript: '/typescript.svg',
        'next.js': '/next.svg',
      })
    ).toEqual([
      { name: 'typescript', iconUrl: '/typescript.svg' },
      { name: 'next.js', iconUrl: '/next.svg' },
    ])
    expect(normalizeSvglRoute('/library/next.svg')).toBe('https://svgl.app/library/next.svg')
  })
})
