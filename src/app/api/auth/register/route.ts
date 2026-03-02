import { NextRequest, NextResponse } from 'next/server'
import { createAppUser, isUniqueConstraintError } from '@/lib/app-users'
import { hashPassword, isValidEmail, isValidPassword, normalizeEmail } from '@/lib/password-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode.trim() : ''

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: 'Email, password, and invite code are required.' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const configuredInviteCode = process.env.INVITE_CODE
    if (!configuredInviteCode) {
      return NextResponse.json(
        { error: 'Invite system is not configured.' },
        { status: 500 }
      )
    }

    if (inviteCode !== configuredInviteCode) {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 403 })
    }

    const passwordHash = hashPassword(password)
    const user = await createAppUser(email, passwordHash)

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }
}
