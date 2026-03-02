import { NextRequest, NextResponse } from 'next/server'
import { getFeedHealthMetrics, getUserSettings, upsertFeedHealthMetric } from '@/lib/user-settings'
import { isAnalysisInProgress, lockAnalysis, unlockAnalysis } from '@/lib/analysis-lock'
import { getNewslettersFromRss } from '@/lib/rss-ingestion'
import { resolveRuntimeUserId, UnauthorizedRuntimeUserError } from '@/lib/runtime-user'
import { completeIngestionRun, persistNewsletterItems, startIngestionRun } from '@/lib/ingestion-log'
import {
  analyzeNewslettersIncremental,
  createEmptyDigest,
  resolvePreferredProvider,
} from '@/lib/incremental-analysis'
import { getCachedSummariesForWindow } from '@/lib/cache-db'
import { getLatestDigestSnapshot } from '@/lib/digest-snapshots'

export const dynamic = 'force-dynamic'

function parseConfiguredFeeds(): string[] {
  const fromEnv = process.env.RSS_FEEDS || ''
  return fromEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  let runId: number | null = null

  try {
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('days') || '7')
    const summarize = searchParams.get('summarize') !== 'false'
    const refresh = searchParams.get('refresh') === 'true'
    const userId = await resolveRuntimeUserId(request)

    const settings = await getUserSettings(userId)
    const feedHealth = await getFeedHealthMetrics(userId)

    // On regular page load, serve persisted data only.
    if (!refresh) {
      const [summaries, latestSnapshot] = await Promise.all([
        getCachedSummariesForWindow(userId, daysBack),
        getLatestDigestSnapshot(userId, daysBack),
      ])

      return NextResponse.json({
        summaries,
        digest: latestSnapshot?.digest || createEmptyDigest(summaries.length),
        rawCount: summaries.length,
        cacheStats: { hits: summaries.length, misses: 0 },
        feedHealth,
        refreshed: false,
      })
    }

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

    runId = await startIngestionRun({
      userId,
      triggerType: 'manual',
      daysBack,
      feedCount: configuredFeeds.length,
    })
    const ingestionRunId = runId

    const rssResult = await getNewslettersFromRss(configuredFeeds, {
      daysBack,
      feedFilters: settings.newsletterSenders.length > 0 ? settings.newsletterSenders : undefined,
    })
    const newsletters = rssResult.newsletters

    await Promise.all(rssResult.metrics.map((metric) => upsertFeedHealthMetric(userId, metric)))
    await persistNewsletterItems(userId, newsletters, ingestionRunId)
    const latestFeedHealth = await getFeedHealthMetrics(userId)

    if (summarize && newsletters.length > 0) {
      const userEmail = userId
      const preferredProvider = resolvePreferredProvider()

      if (isAnalysisInProgress(userEmail)) {
        await completeIngestionRun({
          runId: ingestionRunId,
          status: 'failed',
          newsletterCount: newsletters.length,
          summarizedCount: 0,
          errorText: 'Analysis already in progress',
        })
        return NextResponse.json(
          { error: 'Analysis already in progress. Please wait for it to complete.' },
          { status: 429 }
        )
      }
      
      if (!lockAnalysis(userEmail)) {
        await completeIngestionRun({
          runId: ingestionRunId,
          status: 'failed',
          newsletterCount: newsletters.length,
          summarizedCount: 0,
          errorText: 'Failed to acquire analysis lock',
        })
        return NextResponse.json(
          { error: 'Failed to start analysis. Please try again.' },
          { status: 500 }
        )
      }
      
      try {
        const analysisResult = await analyzeNewslettersIncremental({
          newsletters,
          userId: userEmail,
          daysBack,
          senderOverrides: settings.senderOverrides,
          sourceRunId: ingestionRunId,
          preferredProvider,
        })

        await completeIngestionRun({
          runId: ingestionRunId,
          status: 'succeeded',
          newsletterCount: newsletters.length,
          summarizedCount: analysisResult.newlySummarized,
        })

        return NextResponse.json({
          summaries: analysisResult.summaries,
          digest: analysisResult.digest,
          rawCount: newsletters.length,
          cacheStats: analysisResult.cacheStats,
          analyzedNewCount: analysisResult.newlySummarized,
          providerUsed: analysisResult.providerUsed,
          feedHealth: latestFeedHealth,
          refreshed: true,
        })
      } finally {
        unlockAnalysis(userEmail)
      }
    }

    const latestSnapshot = await getLatestDigestSnapshot(userId, daysBack)

    await completeIngestionRun({
      runId: ingestionRunId,
      status: 'succeeded',
      newsletterCount: newsletters.length,
      summarizedCount: 0,
    })

    if (summarize) {
      return NextResponse.json({
        summaries: [],
        digest: latestSnapshot?.digest || createEmptyDigest(0),
        rawCount: newsletters.length,
        cacheStats: { hits: 0, misses: 0 },
        feedHealth: latestFeedHealth,
        refreshed: true,
      })
    }

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
      feedHealth: latestFeedHealth,
      refreshed: true,
    })
  } catch (error) {
    if (error instanceof UnauthorizedRuntimeUserError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (runId) {
      try {
        await completeIngestionRun({
          runId,
          status: 'failed',
          newsletterCount: 0,
          summarizedCount: 0,
          errorText: error instanceof Error ? error.message : 'Unknown ingestion error',
        })
      } catch (completionError) {
        console.error('Error completing failed ingestion run:', completionError)
      }
    }

    console.error('Error fetching newsletters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}

