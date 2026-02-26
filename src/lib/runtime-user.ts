import { NextRequest } from 'next/server'

export const DEFAULT_RUNTIME_USER = 'local-user'

export function resolveRuntimeUserId(request?: NextRequest): string {
  const fromHeader = request?.headers.get('x-user-id')?.trim()
  if (fromHeader) return fromHeader
  return DEFAULT_RUNTIME_USER
}
