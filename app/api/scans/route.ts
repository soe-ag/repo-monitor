import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { handleRouteError, parseJsonBody } from '@/lib/apiRoute'
import { scanBodySchema } from '@/lib/apiSchemas'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function GET(request: Request) {
  try {
    const client = getConvexHttpClient()
    const repositories = await client.query(anyApi.scans.listRepositoryDashboard, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })

    const url = new URL(request.url)
    const repositoryId = url.searchParams.get('repositoryId')
    if (repositoryId) {
      return NextResponse.json(
        repositories.filter((repository: { _id: string }) => repository._id === repositoryId)
      )
    }

    return NextResponse.json(repositories)
  } catch (error) {
    return handleRouteError(error, 'GET /api/scans')
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, scanBodySchema)
    if (!body.ok) return body.response

    const client = getConvexHttpClient()

    if (body.data.mode === 'single') {
      const result = await client.mutation(anyApi.scans.triggerScanSingleRepository, {
        repositoryId: body.data.repositoryId,
      })
      return NextResponse.json(result)
    }

    const result = await client.mutation(anyApi.scans.triggerScanAll, {
      connectionKey: DEFAULT_CONNECTION_KEY,
      repositoryIds: body.data.repositoryIds,
    })
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'POST /api/scans')
  }
}
