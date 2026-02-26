import { NextRequest, NextResponse } from 'next/server'
import { resolveRuntimeUserId } from '@/lib/runtime-user'
import { isSemanticSearchConfigured, semanticSearchSummaries } from '@/lib/semantic-search'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim() || ''
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10', 10), 25)
    const userId = resolveRuntimeUserId(request)

    if (!q) {
      return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })
    }

    if (!isSemanticSearchConfigured()) {
      return NextResponse.json(
        { error: 'Semantic search not configured. Set OPENAI_API_KEY.' },
        { status: 400 }
      )
    }

    const results = await semanticSearchSummaries(q, userId, limit)
    return NextResponse.json({
      query: q,
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Semantic search error:', error)
    return NextResponse.json({ error: 'Failed semantic search' }, { status: 500 })
  }
}
