'use client'

import { signIn } from 'next-auth/react'
import { Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md w-full animate-fade-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-ink-400 hover:text-ink-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-coral-500 to-coral-600 flex items-center justify-center">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Sign In</h1>
          <p className="text-ink-400">
            Connect your Microsoft 365 account to get started
          </p>
        </div>

        <button
          onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
          className="w-full py-4 px-6 bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
            <path d="M10 0H0V10H10V0Z" fill="#F25022" />
            <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
            <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
            <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
          </svg>
          Continue with Microsoft
        </button>

        <p className="mt-6 text-xs text-ink-500 text-center">
          We request read-only access to your emails to find and summarize newsletters.
          Your data is never stored permanently.
        </p>
      </div>
    </div>
  )
}

