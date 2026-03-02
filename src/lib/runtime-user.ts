import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export const DEFAULT_RUNTIME_USER = 'local-user'

export class UnauthorizedRuntimeUserError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'UnauthorizedRuntimeUserError'
  }
}

function allowDevFallback(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_RUNTIME_USER_HEADER === 'true'
}

export async function resolveRuntimeUserId(request?: NextRequest): Promise<string> {
  const session = await getServerSession(authOptions)
  const fromSession = session?.user?.email?.trim().toLowerCase()
  if (fromSession) return fromSession

  if (!allowDevFallback()) {
    throw new UnauthorizedRuntimeUserError()
  }

  const fromHeader = request?.headers.get('x-user-id')?.trim()
  if (fromHeader) return fromHeader.toLowerCase()
  return DEFAULT_RUNTIME_USER
}
