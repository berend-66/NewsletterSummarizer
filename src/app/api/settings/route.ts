import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getUserSettings,
  updateUserSettings,
  addNewsletterSender,
  removeNewsletterSender,
} from '@/lib/user-settings'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = getUserSettings(session.user.email)
    return NextResponse.json(settings)
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
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = updateUserSettings(session.user.email, body)
    return NextResponse.json(settings)
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
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, sender } = body

    if (action === 'add' && sender) {
      const settings = addNewsletterSender(session.user.email, sender)
      return NextResponse.json(settings)
    } else if (action === 'remove' && sender) {
      const settings = removeNewsletterSender(session.user.email, sender)
      return NextResponse.json(settings)
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

