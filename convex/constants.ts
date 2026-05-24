export const HEALTH_STATUSES = ['ok', 'warning', 'missing', 'stale', 'error', 'unknown'] as const

export type HealthStatus = (typeof HEALTH_STATUSES)[number]

export const README_STALE_DAYS = 180
export const README_STALE_MS = README_STALE_DAYS * 24 * 60 * 60 * 1000

export const PACKAGE_POLICIES = ['any-newer', 'minor-or-major', 'major-only'] as const

export type PackagePolicy = (typeof PACKAGE_POLICIES)[number]

export const DEFAULT_CONNECTION_KEY = 'default'
export const DEFAULT_PACKAGE_POLICY: PackagePolicy = 'any-newer'
