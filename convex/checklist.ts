import { README_STALE_MS, type HealthStatus } from './constants'

export type ChecklistFinding = {
  checkKey: string
  status: HealthStatus
  detail?: string
}

export function isRequiredChecklistFinding(checkKey: string) {
  return checkKey !== 'dependabot-config'
}

export function evaluateTestsConfigured(testScript: string | undefined): ChecklistFinding {
  if (!testScript || testScript.includes('no test specified')) {
    return {
      checkKey: 'tests-configured',
      status: 'missing',
      detail: 'No test script found in package.json',
    }
  }

  return {
    checkKey: 'tests-configured',
    status: 'ok',
    detail: `Test script detected: ${testScript}`,
  }
}

export function evaluateReadmeFreshness(
  readmeExists: boolean,
  readmeCommitDate: Date | null
): ChecklistFinding {
  if (!readmeExists) {
    return {
      checkKey: 'readme-freshness',
      status: 'missing',
      detail: 'README freshness cannot be measured because README is missing',
    }
  }

  if (!readmeCommitDate) {
    return {
      checkKey: 'readme-freshness',
      status: 'unknown',
      detail: 'Unable to determine README commit date',
    }
  }

  const isStale = Date.now() - readmeCommitDate.getTime() > README_STALE_MS
  return {
    checkKey: 'readme-freshness',
    status: isStale ? 'stale' : 'ok',
    detail: isStale
      ? 'README was updated more than 6 months ago'
      : 'README updated within 6 months',
  }
}

export function summarizeStatuses(statuses: HealthStatus[]): HealthStatus {
  if (statuses.length === 0) {
    return 'unknown'
  }
  if (statuses.includes('error')) {
    return 'error'
  }
  if (statuses.includes('stale')) {
    return 'stale'
  }
  if (statuses.includes('missing')) {
    return 'missing'
  }
  if (statuses.includes('warning')) {
    return 'warning'
  }
  if (statuses.every((status) => status === 'ok')) {
    return 'ok'
  }
  return 'unknown'
}
