import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { handleRouteError } from '@/lib/apiRoute'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function PUT() {
  try {
    const client = getConvexHttpClient()
    const result = await client.action(anyApi.scans.refreshRepositories, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) {
    return handleRouteError(error, 'PUT /api/repositories')
  }
}
