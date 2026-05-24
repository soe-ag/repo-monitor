import { describe, expect, it } from 'vitest'
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
  it('respects package policy thresholds', () => {
    expect(statusForPackageUpdate('patch', 'any-newer')).toBe('warning')
    expect(statusForPackageUpdate('patch', 'minor-or-major')).toBe('ok')
    expect(statusForPackageUpdate('minor', 'minor-or-major')).toBe('warning')
    expect(statusForPackageUpdate('minor', 'major-only')).toBe('ok')
    expect(statusForPackageUpdate('major', 'major-only')).toBe('warning')
    expect(statusForPackageUpdate('unknown', 'major-only')).toBe('unknown')
  })
})
