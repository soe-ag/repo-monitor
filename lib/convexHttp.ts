import { ConvexHttpClient } from 'convex/browser'

let client: ConvexHttpClient | null = null

export function getConvexHttpClient() {
  if (client) {
    return client
  }

  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!deploymentUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  }

  client = new ConvexHttpClient(deploymentUrl)
  const adminKey = process.env.CONVEX_ADMIN_KEY
  if (adminKey) {
    client.setAdminAuth(adminKey)
  }
  return client
}

