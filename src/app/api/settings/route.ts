import { NextRequest, NextResponse } from 'next/server'
import {
  getFeedHealthMetrics,
  getUserSettings,
  updateUserSettings,
  addNewsletterSender,
  removeNewsletterSender,
} from '@/lib/user-settings'
import { resolveRuntimeUserId, UnauthorizedRuntimeUserError } from '@/lib/runtime-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveRuntimeUserId(request)
    const [settings, feedHealth] = await Promise.all([
      getUserSettings(userId),
      getFeedHealthMetrics(userId),
    ])
    return NextResponse.json({
      ...settings,
      feedHealth,
    })
  } catch (error) {
    if (error instanceof UnauthorizedRuntimeUserError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await resolveRuntimeUserId(request)
    const body = await request.json()

    if (body.rssFeeds !== undefined) {
      if (!Array.isArray(body.rssFeeds)) {
        return NextResponse.json({ error: 'rssFeeds must be an array' }, { status: 400 })
      }
      const invalid = body.rssFeeds.filter((f: unknown) => typeof f !== 'string' || !isValidUrl(f))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid feed URLs: ${invalid.join(', ')}` },
          { status: 400 }
        )
      }
    }

    if (body.autoDetect !== undefined && typeof body.autoDetect !== 'boolean') {
      return NextResponse.json({ error: 'autoDetect must be a boolean' }, { status: 400 })
    }

    const settings = await updateUserSettings(userId, body)
    const feedHealth = await getFeedHealthMetrics(userId)
    return NextResponse.json({
      ...settings,
      feedHealth,
    })
  } catch (error) {
    if (error instanceof UnauthorizedRuntimeUserError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveRuntimeUserId(request)
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
    if (error instanceof UnauthorizedRuntimeUserError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Error modifying sender:', error)
    return NextResponse.json(
      { error: 'Failed to modify sender' },
      { status: 500 }
    )
  }
}

