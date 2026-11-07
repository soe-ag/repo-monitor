import { anyApi } from 'convex/server'
import { NextResponse } from 'next/server'
import { DEFAULT_CONNECTION_KEY } from '@/convex/constants'
import { handleRouteError, parseJsonBody } from '@/lib/apiRoute'
import { connectBodySchema, packagePolicyBodySchema } from '@/lib/apiSchemas'
import { getConvexHttpClient } from '@/lib/convexHttp'

export async function GET() {
  try {
    const client = getConvexHttpClient()
    const state = await client.query(anyApi.githubConnections.getConnectionState, {
      connectionKey: DEFAULT_CONNECTION_KEY,
    })
    return NextResponse.json(state)
  } catch (error) {
    return handleRouteError(error, 'GET /api/github-connection')
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, connectBodySchema)
    if (!body.ok) return body.response

    const client = getConvexHttpClient()
    const result = await client.action(anyApi.githubConnections.connectWithPat, {
      pat: body.data.pat,
      connectionKey: DEFAULT_CONNECTION_KEY,
      packagePolicy: body.data.packagePolicy,
    })
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'POST /api/github-connection')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseJsonBody(request, packagePolicyBodySchema)
    if (!body.ok) return body.response

    const client = getConvexHttpClient()
    const result = await client.mutation(anyApi.githubConnections.updatePackagePolicy, {
      connectionKey: DEFAULT_CONNECTION_KEY,
      packagePolicy: body.data.packagePolicy,
    })
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/github-connection')
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
    return handleRouteError(error, 'PUT /api/github-connection')
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
    return handleRouteError(error, 'DELETE /api/github-connection')
  }
}
