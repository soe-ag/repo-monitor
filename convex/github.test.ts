import { describe, expect, it } from 'vitest'
import { PACKAGE_UPDATE_MINIMUM_AGE_MS } from './constants'
import { classifyVersionUpdate, statusForPackageUpdate } from './github'

describe('classifyVersionUpdate', () => {
  it('detects patch, minor, major, none, and unknown changes', () => {
    expect(classifyVersionUpdate('1.2.3', '1.2.4')).toBe('patch')
    expect(classifyVersionUpdate('1.2.3', '1.3.0')).toBe('minor')
    expect(classifyVersionUpdate('1.2.3', '2.0.0')).toBe('major')
    expect(classifyVersionUpdate('1.2.3', '1.2.3')).toBe('none')
    expect(classifyVersionUpdate('workspace:*', '2.0.0')).toBe('unknown')
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
