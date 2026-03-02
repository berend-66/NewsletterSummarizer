'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function SignInPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: '/',
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password.')
      return
    }

    window.location.href = result?.url || '/'
  }

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          inviteCode,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Unable to create account.')
        setLoading(false)
        return
      }

      const signInResult = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: '/',
        redirect: false,
      })

      setLoading(false)
      if (signInResult?.error) {
        setError('Account created, but auto sign-in failed. Please sign in manually.')
        setIsRegisterMode(false)
        return
      }

      window.location.href = signInResult?.url || '/'
    } catch {
      setLoading(false)
      setError('Unable to create account.')
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-ink-400 hover:text-ink-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <ThemeToggle className="p-2" />
        </div>

        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-coral-500 to-coral-600 flex items-center justify-center">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">
            {isRegisterMode ? 'Create Account' : 'Sign In'}
          </h1>
          <p className="text-ink-400">
            {isRegisterMode
              ? 'Use your invite code to create an account'
              : 'Use your email and password'}
          </p>
        </div>

        <form onSubmit={isRegisterMode ? submitRegister : submitSignIn} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-3 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-coral-500/50 transition-colors"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full px-4 py-3 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-coral-500/50 transition-colors"
            autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
            required
          />

          {isRegisterMode && (
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Invite code"
              className="w-full px-4 py-3 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-coral-500/50 transition-colors"
              required
            />
          )}

          {error && <p className="text-sm text-coral-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isRegisterMode ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setIsRegisterMode((current) => !current)
          }}
          className="mt-4 w-full text-sm text-ink-400 hover:text-ink-200 transition-colors"
        >
          {isRegisterMode ? 'Already have an account? Sign in' : 'Need an account? Use an invite code'}
        </button>

        <p className="mt-6 text-xs text-ink-500 text-center">
          Invite-only beta: ask your team admin for the shared invite code.
        </p>
      </div>
    </div>
  )
}

