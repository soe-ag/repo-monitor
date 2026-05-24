import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function GET() {
  try {
    const client = getConvexHttpClient()
    const state = await client.query(anyApi.githubConnections.getConnectionState, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(state)
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
      pat?: string
      packagePolicy?: 'any-newer' | 'minor-or-major' | 'major-only'
    }

    if (!body.pat) {
      return NextResponse.json({ error: 'PAT is required' }, { status: 400 })
    }

    const client = getConvexHttpClient()
    const result = await client.action(anyApi.githubConnections.connectWithPat, {
      pat: body.pat,
      connectionKey: DEFAULT_CONNECTION_KEY,
      packagePolicy: body.packagePolicy,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      packagePolicy?: 'any-newer' | 'minor-or-major' | 'major-only'
    }
    if (!body.packagePolicy) {
      return NextResponse.json({ error: 'packagePolicy is required' }, { status: 400 })
    }

    const client = getConvexHttpClient()
    const result = await client.mutation(anyApi.githubConnections.updatePackagePolicy, {
      connectionKey: DEFAULT_CONNECTION_KEY,
      packagePolicy: body.packagePolicy,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT() {
  try {
    const client = getConvexHttpClient()
    const refreshResult = await client.action(anyApi.githubConnections.refreshConnectionProfile, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    if (!refreshResult.ok) {
      return NextResponse.json(
        { error: refreshResult.message ?? 'Failed to refresh profile' },
        { status: 400 }
      )
    }

    const state = await client.query(anyApi.githubConnections.getConnectionState, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(state)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const client = getConvexHttpClient()
    const result = await client.mutation(anyApi.githubConnections.deleteConnection, {
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
