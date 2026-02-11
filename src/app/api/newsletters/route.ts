import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmails, isLikelyNewsletter } from '@/lib/microsoft-graph'
import { summarizeNewsletters } from '@/lib/ollama-summarizer'
import { getUserSettings } from '@/lib/user-settings'
import { isAnalysisInProgress, lockAnalysis, unlockAnalysis } from '@/lib/analysis-lock'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('days') || '7')
    const summarize = searchParams.get('summarize') !== 'false'

    // Get user settings
    const settings = getUserSettings(session.user?.email || 'default')

    // Fetch emails
    const emails = await getEmails(session.accessToken, {
      senderFilters: settings.newsletterSenders.length > 0 ? settings.newsletterSenders : undefined,
      daysBack,
      top: 50,
    })

    // Filter for likely newsletters if auto-detect is enabled
    let newsletters = emails
    if (settings.autoDetect && settings.newsletterSenders.length === 0) {
      newsletters = emails.filter(isLikelyNewsletter)
    }

    // If summarize is requested, process with Ollama
    if (summarize && newsletters.length > 0) {
      const userEmail = session.user?.email || 'default'
      
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
        })
      } finally {
        // Always unlock, even if there's an error
        unlockAnalysis(userEmail)
      }
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
        isRead: n.isRead,
      })),
      rawCount: newsletters.length,
    })
  } catch (error) {
    console.error('Error fetching newsletters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}

