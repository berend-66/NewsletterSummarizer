import { NextRequest, NextResponse } from 'next/server'
import {
  getUserSettings,
  getUsersWithFeeds,
  upsertFeedHealthMetric,
} from '@/lib/user-settings'
import { getNewslettersFromRss } from '@/lib/rss-ingestion'
import { isAnalysisInProgress, lockAnalysis, unlockAnalysis } from '@/lib/analysis-lock'
import { DEFAULT_RUNTIME_USER } from '@/lib/runtime-user'
import {
  completeIngestionRun,
  getLatestSuccessfulIngestionRun,
  persistNewsletterItems,
  startIngestionRun,
} from '@/lib/ingestion-log'
import { analyzeNewslettersIncremental, resolvePreferredProvider } from '@/lib/incremental-analysis'

export const dynamic = 'force-dynamic'

function parseConfiguredFeeds(): string[] {
  const fromEnv = process.env.RSS_FEEDS || ''
  return fromEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function isCronAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) return true

  const fromHeader = request.headers.get('x-cron-secret')
  const fromAuth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  return fromHeader === configuredSecret || fromAuth === configuredSecret
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const daysBack = parseInt(request.nextUrl.searchParams.get('days') || '7')
  const force = request.nextUrl.searchParams.get('force') === 'true'
  const minIntervalHours = Math.max(1, parseInt(process.env.CRON_MIN_INTERVAL_HOURS || '12'))
  const minIntervalMs = minIntervalHours * 60 * 60 * 1000
  const fallbackFeeds = parseConfiguredFeeds()
  const users = await getUsersWithFeeds()
  const targetUsers = users.length > 0 ? users : [DEFAULT_RUNTIME_USER]
  const preferredProvider = resolvePreferredProvider()

  const results: Array<{
    userId: string
    feedCount: number
    newsletterCount: number
    summarized: number
    skipped: boolean
    error?: string
  }> = []

  for (const userId of targetUsers) {
    let runId: number | null = null
    let newsletterCount = 0
    let summarized = 0

    const settings = await getUserSettings(userId)
    const configuredFeeds = settings.rssFeeds.length > 0 ? settings.rssFeeds : fallbackFeeds

    if (configuredFeeds.length === 0) {
      results.push({
        userId,
        feedCount: 0,
        newsletterCount: 0,
        summarized: 0,
        skipped: true,
        error: 'No RSS feeds configured',
      })
      continue
    }

    if (!force) {
      const latestRun = await getLatestSuccessfulIngestionRun(userId, 'cron')
      if (latestRun) {
        const elapsedMs = Date.now() - new Date(latestRun.completedAt).valueOf()
        if (elapsedMs < minIntervalMs) {
          const remainingMs = minIntervalMs - elapsedMs
          const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
          results.push({
            userId,
            feedCount: configuredFeeds.length,
            newsletterCount: 0,
            summarized: 0,
            skipped: true,
            error: `Skipped: minimum interval not reached (${remainingMinutes}m remaining)`,
          })
          continue
        }
      }
    }

    runId = await startIngestionRun({
      userId,
      triggerType: 'cron',
      daysBack,
      feedCount: configuredFeeds.length,
    })
    const ingestionRunId = runId

    if (isAnalysisInProgress(userId) || !lockAnalysis(userId)) {
      await completeIngestionRun({
        runId: ingestionRunId,
        status: 'failed',
        newsletterCount: 0,
        summarizedCount: 0,
        errorText: 'Analysis already in progress',
      })
      results.push({
        userId,
        feedCount: configuredFeeds.length,
        newsletterCount: 0,
        summarized: 0,
        skipped: true,
        error: 'Analysis already in progress',
      })
      continue
    }

    try {
      const rssResult = await getNewslettersFromRss(configuredFeeds, {
        daysBack,
        feedFilters: settings.newsletterSenders.length > 0 ? settings.newsletterSenders : undefined,
      })

      await Promise.all(rssResult.metrics.map((metric) => upsertFeedHealthMetric(userId, metric)))
      newsletterCount = rssResult.newsletters.length
      await persistNewsletterItems(userId, rssResult.newsletters, ingestionRunId)

      if (rssResult.newsletters.length > 0) {
        const analysisResult = await analyzeNewslettersIncremental({
          newsletters: rssResult.newsletters,
          userId,
          daysBack,
          senderOverrides: settings.senderOverrides,
          sourceRunId: ingestionRunId,
          preferredProvider,
        })
        summarized = analysisResult.newlySummarized
      }

      await completeIngestionRun({
        runId: ingestionRunId,
        status: 'succeeded',
        newsletterCount,
        summarizedCount: summarized,
      })

      results.push({
        userId,
        feedCount: configuredFeeds.length,
        newsletterCount,
        summarized,
        skipped: false,
      })
    } catch (error) {
      if (runId) {
        try {
          await completeIngestionRun({
            runId,
            status: 'failed',
            newsletterCount,
            summarizedCount: summarized,
            errorText: error instanceof Error ? error.message : 'Unknown cron error',
          })
        } catch (completionError) {
          console.error('Error completing failed cron ingestion run:', completionError)
        }
      }

      results.push({
        userId,
        feedCount: configuredFeeds.length,
        newsletterCount,
        summarized,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown cron error',
      })
    } finally {
      unlockAnalysis(userId)
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    daysBack,
    userCount: targetUsers.length,
    results,
  })
}
