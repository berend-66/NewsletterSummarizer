'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { 
  Mail, 
  RefreshCw, 
  Settings, 
  LogOut, 
  Sparkles,
  ChevronRight,
  Clock,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  Loader2,
  MailOpen,
  Play,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { demoSummaries, demoDigest } from '@/lib/demo-data'

interface NewsletterSummary {
  id: string
  subject: string
  sender: string
  senderEmail: string
  receivedAt: string
  summary: string
  keyPoints: string[]
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  readTime: number
}

interface CombinedDigest {
  generatedAt: string
  totalNewsletters: number
  themes: {
    theme: string
    description: string
    relatedNewsletters: string[]
  }[]
  highlights: string[]
  actionItems: string[]
}

interface DigestData {
  summaries: NewsletterSummary[]
  digest: CombinedDigest
  rawCount: number
}

export default function Home() {
  const { data: session, status } = useSession()
  const [digestData, setDigestData] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [daysBack, setDaysBack] = useState(7)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [progress, setProgress] = useState<{
    percentage: number
    current: number
    total: number
    currentNewsletter: string
    estimatedTimeMs: number
  } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchDigest = async () => {
    if (!session) return
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    setLoading(true)
    setProgress(null)
    
    // Start polling for progress
    const progressInterval = setInterval(async () => {
      if (signal.aborted) return
      
      try {
        const res = await fetch('/api/progress', { signal })
        if (res.ok) {
          const data = await res.json()
          if (data.active) {
            setProgress({
              percentage: data.percentage,
              current: data.completed,
              total: data.total,
              currentNewsletter: data.currentNewsletter,
              estimatedTimeMs: data.estimatedTimeRemainingMs,
            })
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching progress:', error)
        }
      }
    }, 1000) // Poll every second
    
    try {
      const res = await fetch(`/api/newsletters?days=${daysBack}&summarize=true`, { signal })
      if (res.ok) {
        const data = await res.json()
        setDigestData(data)
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled')
      } else {
        console.error('Error fetching digest:', error)
      }
    } finally {
      clearInterval(progressInterval)
      setLoading(false)
      setProgress(null)
      abortControllerRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const loadDemoData = () => {
    setDemoMode(true)
    setLoading(true)
    // Simulate loading for effect
    setTimeout(() => {
      setDigestData({
        summaries: demoSummaries,
        digest: demoDigest,
        rawCount: demoSummaries.length,
      })
      setLoading(false)
    }, 1500)
  }

  const exitDemo = () => {
    setDemoMode(false)
    setDigestData(null)
  }

  useEffect(() => {
    if (session && !demoMode) {
      fetchDigest()
    }
  }, [session])

  if (status === 'loading') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
          <p className="text-ink-300">Loading...</p>
        </div>
      </div>
    )
  }

  // Show dashboard if signed in OR in demo mode
  if (session || demoMode) {
    return (
      <div className="min-h-screen mesh-bg">
        {/* Header */}
        <header className="border-b border-ink-700/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-500 to-coral-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg flex items-center gap-2">
                  Newsletter Digest
                  {demoMode && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-normal">
                      Demo Mode
                    </span>
                  )}
                </h1>
                <p className="text-xs text-ink-400">
                  {demoMode ? 'Viewing sample newsletters' : session?.user?.email}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {demoMode ? (
                <button
                  onClick={exitDemo}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 transition-colors text-sm text-ink-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Exit Demo
                </button>
              ) : (
                <>
                  <Link
                    href="/settings"
                    className="p-2.5 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5 text-ink-300" />
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="p-2.5 rounded-lg bg-ink-800/50 hover:bg-ink-700/50 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-5 h-5 text-ink-300" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-2 glass-card px-4 py-2">
              <Clock className="w-4 h-4 text-ink-400" />
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(parseInt(e.target.value))}
                className="bg-transparent text-ink-200 outline-none cursor-pointer"
                disabled={demoMode}
              >
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>
            
            {!demoMode && (
              <button
                onClick={fetchDigest}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-mint-500 to-mint-600 hover:from-mint-600 hover:to-mint-500 text-ink-950 font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {loading ? 'Analyzing...' : 'Refresh'}
              </button>
            )}

            {digestData && (
              <span className="text-ink-400 text-sm">
                {digestData.rawCount} newsletter{digestData.rawCount !== 1 ? 's' : ''} found
              </span>
            )}
          </div>

          {loading && !digestData && (
            <div className="glass-card p-8 text-center">
              {progress ? (
                <div className="max-w-2xl mx-auto">
                  {/* Progress Header */}
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <Loader2 className="w-6 h-6 text-coral-500 animate-spin" />
                    <h3 className="text-xl font-semibold">
                      Analyzing newsletters...
                    </h3>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-ink-400 mb-2">
                      <span>{progress.current} of {progress.total} completed</span>
                      <span>{progress.percentage}%</span>
                    </div>
                    <div className="w-full h-3 bg-ink-800/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-mint-500 to-mint-600 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Newsletter */}
                  {progress.currentNewsletter && (
                    <div className="mb-4">
                      <p className="text-sm text-ink-400 mb-1">Currently analyzing:</p>
                      <p className="text-ink-200 font-medium truncate">
                        {progress.currentNewsletter}
                      </p>
                    </div>
                  )}

                  {/* Estimated Time */}
                  {progress.estimatedTimeMs > 0 && (
                    <div className="flex items-center justify-center gap-2 text-sm text-ink-500">
                      <Clock className="w-4 h-4" />
                      <span>
                        ~{Math.ceil(progress.estimatedTimeMs / 1000)}s remaining
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Loader2 className="w-12 h-12 text-coral-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {demoMode ? 'Loading demo data...' : 'Analyzing your newsletters...'}
                  </h3>
                  <p className="text-ink-400">
                    {demoMode ? 'Preparing sample newsletters to show you.' : 'This may take a moment as we summarize each one.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {digestData && (
            <div className="space-y-8 animate-fade-in">
              {/* Combined Digest */}
              {digestData.digest.themes.length > 0 && (
                <section className="glass-card p-6 animate-slide-up">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl font-display font-bold">Cross-Newsletter Insights</h2>
                  </div>

                  {/* Themes */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                      Common Themes
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {digestData.digest.themes.map((theme, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-ink-800/30 border border-ink-700/30"
                        >
                          <h4 className="font-semibold text-mint-400 mb-2">{theme.theme}</h4>
                          <p className="text-sm text-ink-300 mb-3">{theme.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {theme.relatedNewsletters.slice(0, 3).map((nl, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-1 rounded-full bg-ink-700/50 text-ink-300"
                              >
                                {nl.length > 30 ? nl.slice(0, 30) + '...' : nl}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Highlights */}
                  {digestData.digest.highlights.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                        <Lightbulb className="w-4 h-4 inline mr-1" />
                        Top Highlights
                      </h3>
                      <ul className="space-y-2">
                        {digestData.digest.highlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-ink-200">
                            <span className="text-amber-500 mt-1">•</span>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {digestData.digest.actionItems.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        Action Items
                      </h3>
                      <ul className="space-y-2">
                        {digestData.digest.actionItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-ink-200">
                            <span className="text-coral-500 mt-1">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Individual Summaries */}
              <section>
                <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
                  <MailOpen className="w-5 h-5 text-coral-500" />
                  Newsletter Summaries
                </h2>

                <div className="space-y-4">
                  {digestData.summaries.map((summary, idx) => (
                    <div
                      key={summary.id}
                      className={`glass-card overflow-hidden animate-slide-up`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <button
                        onClick={() => setExpandedId(expandedId === summary.id ? null : summary.id)}
                        className="w-full p-4 text-left flex items-start gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-ink-400">
                              {summary.sender}
                            </span>
                            <span className="text-xs text-ink-500">•</span>
                            <span className="text-xs text-ink-500">
                              {new Date(summary.receivedAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-ink-500">•</span>
                            <span className="text-xs text-ink-500">
                              {summary.readTime} min read
                            </span>
                          </div>
                          <h3 className="font-semibold text-ink-100 mb-2 truncate">
                            {summary.subject}
                          </h3>
                          <p className="text-sm text-ink-300 line-clamp-2">
                            {summary.summary}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {summary.topics.map((topic, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full tag-default"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-5 h-5 text-ink-400 transition-transform flex-shrink-0 ${
                            expandedId === summary.id ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {expandedId === summary.id && (
                        <div className="px-4 pb-4 border-t border-ink-700/30 pt-4 animate-fade-in">
                          <h4 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                            Key Points
                          </h4>
                          <ul className="space-y-2">
                            {summary.keyPoints.map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-ink-200 text-sm">
                                <span className="text-mint-500 mt-0.5">✓</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {digestData.summaries.length === 0 && (
                <div className="glass-card p-12 text-center">
                  <Mail className="w-12 h-12 text-ink-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No newsletters found</h3>
                  <p className="text-ink-400 mb-4">
                    We couldn't find any newsletters in the selected time period.
                  </p>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 text-coral-500 hover:text-coral-400"
                  >
                    <Settings className="w-4 h-4" />
                    Configure newsletter sources
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // Landing page when not signed in
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="glass-card p-8 md:p-12 max-w-lg w-full text-center animate-fade-in">
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-coral-500 to-coral-600 flex items-center justify-center">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">
            Newsletter Digest
          </h1>
          <p className="text-ink-300 text-lg">
            AI-powered summaries of your newsletters, delivered when you need them.
          </p>
        </div>

        <div className="space-y-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-mint-500 mt-0.5 flex-shrink-0" />
            <p className="text-ink-200">Smart summaries with key points extracted</p>
          </div>
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-ink-200">Identify themes across multiple newsletters</p>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-coral-400 mt-0.5 flex-shrink-0" />
            <p className="text-ink-200">Scheduled digests on Monday & Wednesday</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn('azure-ad')}
            className="w-full py-4 px-6 bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-coral-500/25"
          >
            <Mail className="w-5 h-5" />
            Sign in with Microsoft 365
          </button>
          
          <button
            onClick={loadDemoData}
            className="w-full py-4 px-6 bg-ink-800/50 hover:bg-ink-700/50 border border-ink-700/50 text-ink-200 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Try Demo Mode
          </button>
        </div>
        
        <p className="mt-4 text-sm text-ink-400">
          We'll access your emails to find and summarize newsletters.
        </p>
      </div>
    </div>
  )
}
