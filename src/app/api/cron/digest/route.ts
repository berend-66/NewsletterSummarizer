import { NextRequest, NextResponse } from 'next/server'
import { summarizeNewsletters } from '@/lib/ollama-summarizer'
import {
  getUserSettings,
  getUsersWithFeeds,
  upsertFeedHealthMetric,
} from '@/lib/user-settings'
import { getNewslettersFromRss } from '@/lib/rss-ingestion'
import { isAnalysisInProgress, lockAnalysis, unlockAnalysis } from '@/lib/analysis-lock'
import { DEFAULT_RUNTIME_USER } from '@/lib/runtime-user'

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
  const fallbackFeeds = parseConfiguredFeeds()
  const users = await getUsersWithFeeds()
  const targetUsers = users.length > 0 ? users : [DEFAULT_RUNTIME_USER]

  const results: Array<{
    userId: string
    feedCount: number
    newsletterCount: number
    summarized: number
    skipped: boolean
    error?: string
  }> = []

  for (const userId of targetUsers) {
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

    if (isAnalysisInProgress(userId) || !lockAnalysis(userId)) {
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

      let summarized = 0
      if (rssResult.newsletters.length > 0) {
        const summaryResult = await summarizeNewsletters(
          rssResult.newsletters,
          userId,
          settings.senderOverrides
        )
        summarized = summaryResult.summaries.length
      }

      results.push({
        userId,
        feedCount: configuredFeeds.length,
        newsletterCount: rssResult.newsletters.length,
        summarized,
        skipped: false,
      })
    } catch (error) {
      results.push({
        userId,
        feedCount: configuredFeeds.length,
        newsletterCount: 0,
        summarized: 0,
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
