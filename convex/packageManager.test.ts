import { describe, expect, it } from 'vitest'
import { inferPackageManager } from './packageManager'

describe('inferPackageManager', () => {
  it('prefers the packageManager declaration over lockfiles', () => {
    expect(inferPackageManager('npm@11.0.0', ['pnpm-lock.yaml'])).toBe('npm')
    expect(inferPackageManager('pnpm@10.0.0+sha512.example', ['package-lock.json'])).toBe('pnpm')
  })

  it('falls back to npm and pnpm lockfiles', () => {
    expect(inferPackageManager(undefined, ['package-lock.json'])).toBe('npm')
    expect(inferPackageManager(undefined, ['pnpm-lock.yaml'])).toBe('pnpm')
    expect(inferPackageManager(undefined, ['npm-shrinkwrap.json'])).toBe('npm')
  })

  it('returns undefined when neither manager can be identified', () => {
    expect(inferPackageManager(undefined, ['yarn.lock'])).toBeUndefined()
  })
})
