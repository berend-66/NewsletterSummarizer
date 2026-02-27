import { NextRequest, NextResponse } from 'next/server'
import { getProgress, getProgressPercentage, getEstimatedTimeRemaining } from '@/lib/progress-tracker'
import { resolveRuntimeUserId, UnauthorizedRuntimeUserError } from '@/lib/runtime-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userEmail = await resolveRuntimeUserId(request)
    const progress = getProgress(userEmail)
    
    if (!progress) {
      return NextResponse.json({ 
        active: false 
      })
    }

    const percentage = getProgressPercentage(userEmail)
    const estimatedTimeMs = getEstimatedTimeRemaining(userEmail)

    return NextResponse.json({
      active: true,
      total: progress.total,
      completed: progress.completed,
      percentage,
      currentNewsletter: progress.currentNewsletter,
      estimatedTimeRemainingMs: estimatedTimeMs,
    })
  } catch (error) {
    if (error instanceof UnauthorizedRuntimeUserError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    )
  }
}
