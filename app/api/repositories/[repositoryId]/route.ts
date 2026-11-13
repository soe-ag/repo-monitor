import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { handleRouteError } from '@/lib/apiRoute'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repositoryId: string }> }
) {
  try {
    const { repositoryId } = await params
    const client = getConvexHttpClient()
    const details = await client.query(anyApi.scans.getRepositoryDetails, {
      repositoryId,
      connectionKey: DEFAULT_CONNECTION_KEY,
    })

    if (!details) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    return NextResponse.json(details)
  } catch (error) {
    return handleRouteError(error, 'GET /api/repositories/[repositoryId]')
  }
}
