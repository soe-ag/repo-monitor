import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createConvexDataSource } from './data'
import { createRepoMonitorServer } from './server'

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!deploymentUrl) {
  console.error('MCP server cannot start: NEXT_PUBLIC_CONVEX_URL is not set.')
  process.exit(1)
}

const connectionKey = process.env.MCP_CONNECTION_KEY ?? 'default'
const dataSource = createConvexDataSource(deploymentUrl, connectionKey)
serveStdio(() => createRepoMonitorServer(dataSource), {
  onerror: (error) => console.error(`MCP server error: ${error.message}`),
})
console.error(`Repo Monitor MCP server running on stdio for connection '${connectionKey}'.`)
