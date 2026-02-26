import { NextResponse } from 'next/server'
import db, { databaseProvider, ensureDatabaseInitialized } from '@/lib/persistent-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()

  try {
    await ensureDatabaseInitialized()
    await db.query('SELECT 1 AS ok')

    return NextResponse.json({
      status: 'ok',
      checkedAt,
      databaseProvider,
      uptimeSeconds: Math.floor(process.uptime()),
      responseMs: Date.now() - startedAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        checkedAt,
        databaseProvider,
        responseMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    )
  }
}
