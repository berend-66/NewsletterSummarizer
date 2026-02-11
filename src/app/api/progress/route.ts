import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProgress, getProgressPercentage, getEstimatedTimeRemaining } from '@/lib/progress-tracker'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
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
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    )
  }
}
