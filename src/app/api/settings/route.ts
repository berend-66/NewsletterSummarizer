import { NextRequest, NextResponse } from 'next/server'
import {
  getFeedHealthMetrics,
  getUserSettings,
  updateUserSettings,
  addNewsletterSender,
  removeNewsletterSender,
} from '@/lib/user-settings'
import { resolveRuntimeUserId } from '@/lib/runtime-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = resolveRuntimeUserId(request)
    const [settings, feedHealth] = await Promise.all([
      getUserSettings(userId),
      getFeedHealthMetrics(userId),
    ])
    return NextResponse.json({
      ...settings,
      feedHealth,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = resolveRuntimeUserId(request)
    const body = await request.json()
    const settings = await updateUserSettings(userId, body)
    const feedHealth = await getFeedHealthMetrics(userId)
    return NextResponse.json({
      ...settings,
      feedHealth,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = resolveRuntimeUserId(request)
    const body = await request.json()
    const { action, sender } = body

    if (action === 'add' && sender) {
      const settings = await addNewsletterSender(userId, sender)
      const feedHealth = await getFeedHealthMetrics(userId)
      return NextResponse.json({
        ...settings,
        feedHealth,
      })
    } else if (action === 'remove' && sender) {
      const settings = await removeNewsletterSender(userId, sender)
      const feedHealth = await getFeedHealthMetrics(userId)
      return NextResponse.json({
        ...settings,
        feedHealth,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error modifying sender:', error)
    return NextResponse.json(
      { error: 'Failed to modify sender' },
      { status: 500 }
    )
  }
}

