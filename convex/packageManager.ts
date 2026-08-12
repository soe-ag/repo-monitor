export type PackageManager = 'npm' | 'pnpm'

export function inferPackageManager(
  declaredPackageManager: string | undefined,
  rootFileNames: readonly string[]
): PackageManager | undefined {
  const declaredName = declaredPackageManager?.split('@', 1)[0]?.toLowerCase()

  if (declaredName === 'npm' || declaredName === 'pnpm') {
    return declaredName
  }

  const files = new Set(rootFileNames)
  if (files.has('pnpm-lock.yaml')) {
    return 'pnpm'
  }
  if (files.has('package-lock.json') || files.has('npm-shrinkwrap.json')) {
    return 'npm'
  }

  return undefined
}
