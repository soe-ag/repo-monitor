import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
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
      repositoryIds?: string[]
    }

    const client = getConvexHttpClient()

    const selectedRepositoryIds = Array.isArray(body.repositoryIds)
      ? body.repositoryIds.filter((repositoryId) => typeof repositoryId === 'string')
      : []

    if (selectedRepositoryIds.length > 10) {
      return NextResponse.json(
        { ok: false, message: 'Select at most 10 repositories per scan.' },
        { status: 400 }
      )
    }

    if (body.mode === 'single') {
      if (!body.repositoryId) {
        return NextResponse.json(
          { ok: false, message: 'Single scan requires a repositoryId.' },
          { status: 400 }
        )
      }

      if (selectedRepositoryIds.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            message: 'Single scan must not include repositoryIds. Use mode=all for selected scans.',
          },
          { status: 400 }
        )
      }

      const result = await client.mutation(anyApi.scans.triggerScanSingleRepository, {
        repositoryId: body.repositoryId,
      })
      return NextResponse.json(result)
    }

    if (body.mode === 'all') {
      if (selectedRepositoryIds.length === 0) {
        return NextResponse.json(
          { ok: false, message: 'Select repositories to scan (max 10).' },
          { status: 400 }
        )
      }

      if (body.repositoryId) {
        return NextResponse.json(
          {
            ok: false,
            message:
              'Selected scan must use repositoryIds only. Use mode=single for one repository.',
          },
          { status: 400 }
        )
      }

      const result = await client.mutation(anyApi.scans.triggerScanAll, {
        connectionKey: DEFAULT_CONNECTION_KEY,
        repositoryIds: selectedRepositoryIds,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { ok: false, message: 'Invalid scan mode. Use mode="single" or mode="all".' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
