import { NextRequest, NextResponse } from 'next/server'
import { summarizeNewsletters } from '@/lib/ollama-summarizer'
import { getFeedHealthMetrics, getUserSettings, upsertFeedHealthMetric } from '@/lib/user-settings'
import { isAnalysisInProgress, lockAnalysis, unlockAnalysis } from '@/lib/analysis-lock'
import { getNewslettersFromRss } from '@/lib/rss-ingestion'
import { resolveRuntimeUserId } from '@/lib/runtime-user'

export const dynamic = 'force-dynamic'

function createEmptyDigest(totalNewsletters: number) {
  return {
    generatedAt: new Date().toISOString(),
    totalNewsletters,
    themes: [] as Array<{
      theme: string
      description: string
      relatedNewsletters: string[]
    }>,
    highlights: [] as string[],
    actionItems: [] as string[],
  }
}

function parseConfiguredFeeds(): string[] {
  const fromEnv = process.env.RSS_FEEDS || ''
  return fromEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('days') || '7')
    const summarize = searchParams.get('summarize') !== 'false'
    const userId = resolveRuntimeUserId(request)

    // Get user settings
    const settings = await getUserSettings(userId)
    const configuredFeeds =
      settings.rssFeeds.length > 0 ? settings.rssFeeds : parseConfiguredFeeds()

    if (configuredFeeds.length === 0) {
      return NextResponse.json(
        {
          error:
            'No RSS feeds configured. Add feeds in Settings or set RSS_FEEDS in your environment.',
        },
        { status: 400 }
      )
    }

    const rssResult = await getNewslettersFromRss(configuredFeeds, {
      daysBack,
      feedFilters: settings.newsletterSenders.length > 0 ? settings.newsletterSenders : undefined,
    })
    const newsletters = rssResult.newsletters

    await Promise.all(rssResult.metrics.map((metric) => upsertFeedHealthMetric(userId, metric)))
    const feedHealth = await getFeedHealthMetrics(userId)

    // If summarize is requested, process with Ollama
    if (summarize && newsletters.length > 0) {
      const userEmail = userId

      // Check if analysis is already in progress
      if (isAnalysisInProgress(userEmail)) {
        return NextResponse.json(
          { error: 'Analysis already in progress. Please wait for it to complete.' },
          { status: 429 } // Too Many Requests
        )
      }
      
      // Lock analysis for this user
      if (!lockAnalysis(userEmail)) {
        return NextResponse.json(
          { error: 'Failed to start analysis. Please try again.' },
          { status: 500 }
        )
      }
      
      try {
        const { summaries, digest, cacheStats } = await summarizeNewsletters(
          newsletters, 
          userEmail,
          settings.senderOverrides
        )
        return NextResponse.json({
          summaries,
          digest,
          rawCount: newsletters.length,
          cacheStats,
          feedHealth,
        })
      } finally {
        // Always unlock, even if there's an error
        unlockAnalysis(userEmail)
      }
    }

    if (summarize) {
      return NextResponse.json({
        summaries: [],
        digest: createEmptyDigest(newsletters.length),
        rawCount: newsletters.length,
        cacheStats: { hits: 0, misses: 0 },
        feedHealth,
      })
    }

    // Return raw newsletter data without summaries
    return NextResponse.json({
      newsletters: newsletters.map((n) => ({
        id: n.id,
        subject: n.subject,
        sender: n.from.emailAddress.name,
        senderEmail: n.from.emailAddress.address,
        receivedAt: n.receivedDateTime,
        preview: n.bodyPreview,
        source: n.source,
        isRead: n.isRead,
      })),
      rawCount: newsletters.length,
      feedHealth,
    })
  } catch (error) {
    console.error('Error fetching newsletters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}

