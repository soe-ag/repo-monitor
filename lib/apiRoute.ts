import { NextResponse } from 'next/server'
import type { z } from 'zod'

/** 400 response. Includes both `error` and `message` because different UI callers read each. */
export function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message, message }, { status: 400 })
}

/** Logs the real error on the server and returns a generic 500 so internals are not leaked. */
export function handleRouteError(error: unknown, context: string) {
  console.error(`[api] ${context} failed:`, error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/** Reads and validates a JSON request body. Malformed or invalid input becomes a 400. */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParsedBody<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: badRequest('Request body must be valid JSON.') }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    return { ok: false, response: badRequest(issue?.message ?? 'Invalid request body.') }
  }

  return { ok: true, data: result.data }
}
