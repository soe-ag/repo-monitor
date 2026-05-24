import { describe, expect, it, vi } from 'vitest'
import { evaluateReadmeFreshness, evaluateTestsConfigured, summarizeStatuses } from './checklist'

describe('evaluateTestsConfigured', () => {
  it('returns missing when test script is absent', () => {
    expect(evaluateTestsConfigured(undefined)).toMatchObject({
      checkKey: 'tests-configured',
      status: 'missing',
    })
  })

  it('returns ok when test script exists', () => {
    expect(evaluateTestsConfigured('vitest run')).toMatchObject({
      checkKey: 'tests-configured',
      status: 'ok',
    })
  })
})

describe('evaluateReadmeFreshness', () => {
  it('returns missing when readme does not exist', () => {
    expect(evaluateReadmeFreshness(false, null)).toMatchObject({
      checkKey: 'readme-freshness',
      status: 'missing',
    })
  })

  it('returns stale when readme update is beyond threshold', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const oldDate = new Date('2025-01-01T00:00:00.000Z')
    expect(evaluateReadmeFreshness(true, oldDate)).toMatchObject({
      checkKey: 'readme-freshness',
      status: 'stale',
    })
    vi.useRealTimers()
  })
})

describe('summarizeStatuses', () => {
  it('prioritizes severe statuses correctly', () => {
    expect(summarizeStatuses(['ok', 'warning'])).toBe('warning')
    expect(summarizeStatuses(['ok', 'missing'])).toBe('missing')
    expect(summarizeStatuses(['stale', 'warning'])).toBe('stale')
    expect(summarizeStatuses(['error', 'ok'])).toBe('error')
    expect(summarizeStatuses([])).toBe('unknown')
  })
})
