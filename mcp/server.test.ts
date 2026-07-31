import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { expect, test } from 'vitest'
import { createRepoMonitorServer } from './server'
import type { DashboardRepository, RepoMonitorDataSource } from './data'

const repository: DashboardRepository = {
  _id: 'secret-repository-id',
  connectionId: 'secret-connection-id',
  owner: 'octocat',
  name: 'Hello-World',
  fullName: 'octocat/Hello-World',
  visibility: 'public',
  defaultBranch: 'main',
  htmlUrl: 'https://github.com/octocat/Hello-World',
  latestCommitBuildStatus: 'failing',
  latestCommitBuildDetail: 'tests failed',
  latestDeploymentStatus: 'not-deployed',
  latestDeploymentDetail: 'No active deployment',
  lastScanAt: 123,
  lastScanStatus: 'warning',
  packageFindings: [
    {
      packageName: 'react',
      currentVersion: '18.0.0',
      latestVersion: '19.0.0',
      updateType: 'major',
      status: 'warning',
    },
  ],
  checklistFindings: [{ checkKey: 'readme-freshness', status: 'stale', detail: 'README is stale' }],
}

async function connectedClient(dataSource: RepoMonitorDataSource) {
  const server = createRepoMonitorServer(dataSource)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'repo-monitor-test', version: '0.1.0' })
  await client.connect(clientTransport)
  return client
}

test('registers all four tools and returns safe repository data', async () => {
  const client = await connectedClient({
    listDashboard: async () => [repository],
    getConnectionState: async () => ({ status: 'connected', connected: true }),
  })
  const tools = await client.listTools()
  expect(tools.tools.map((tool) => tool.name)).toEqual([
    'list_repositories',
    'get_repository_health',
    'list_attention_items',
    'get_connection_status',
  ])
  const response = await client.callTool({
    name: 'get_repository_health',
    arguments: { fullName: 'OCTOCAT/hello-world' },
  })
  expect(response.isError).not.toBe(true)
  expect(JSON.stringify(response)).not.toContain('secret-repository-id')
  expect(JSON.stringify(response)).not.toContain('secret-connection-id')
  expect(JSON.stringify(response)).toContain('octocat/Hello-World')
})

test('returns only non-ok attention items', async () => {
  const client = await connectedClient({
    listDashboard: async () => [
      repository,
      {
        ...repository,
        _id: 'other',
        fullName: 'octocat/Okay',
        name: 'Okay',
        latestCommitBuildStatus: 'passing',
        latestDeploymentStatus: 'deployed',
        lastScanStatus: 'ok',
        packageFindings: [],
        checklistFindings: [],
      },
    ],
    getConnectionState: async () => ({ status: 'connected', connected: true }),
  })
  const response = await client.callTool({ name: 'list_attention_items' })
  expect(JSON.stringify(response)).toContain('README is stale')
  expect(JSON.stringify(response)).not.toContain('octocat/Okay')
})

test('returns a structured not-found error', async () => {
  const client = await connectedClient({
    listDashboard: async () => [],
    getConnectionState: async () => ({ status: 'connected', connected: true }),
  })
  const response = await client.callTool({
    name: 'get_repository_health',
    arguments: { fullName: 'missing/repository' },
  })
  expect(response.isError).toBe(true)
  expect(JSON.stringify(response)).toContain('NOT_FOUND')
})

test('sanitizes backend failures', async () => {
  const client = await connectedClient({
    listDashboard: async () => {
      throw new Error('token=super-secret')
    },
    getConnectionState: async () => ({ status: 'connected', connected: true }),
  })
  const response = await client.callTool({ name: 'list_repositories' })
  expect(response.isError).toBe(true)
  expect(JSON.stringify(response)).not.toContain('super-secret')
  expect(JSON.stringify(response)).toContain('[redacted]')
})
