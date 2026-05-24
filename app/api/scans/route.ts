import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function GET() {
  try {
    const client = getConvexHttpClient()
    const repositories = await client.query(anyApi.scans.listRepositoryDashboard, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(repositories)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: 'all' | 'single'
      repositoryId?: string
    }

    const client = getConvexHttpClient()

    if (body.mode === 'single' && body.repositoryId) {
      const result = await client.mutation(anyApi.scans.triggerScanSingleRepository, {
        repositoryId: body.repositoryId,
      })
      return NextResponse.json(result)
    }

    const result = await client.mutation(anyApi.scans.triggerScanAll, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
