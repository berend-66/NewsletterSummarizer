'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Rss,
  Plus,
  X,
  Loader2,
  Wand2,
  Calendar,
  Clock,
  Trash2,
  Tag,
  Edit3,
} from 'lucide-react'
import Link from 'next/link'

interface UserSettings {
  userId: string
  rssFeeds: string[]
  feedHealth?: FeedHealthMetric[]
  newsletterSenders: string[]
  senderOverrides: Record<string, string>
  autoDetect: boolean
  digestDays: ('monday' | 'wednesday')[]
  digestTime: string
}

interface FeedHealthMetric {
  feedUrl: string
  lastCheckedAt: string
  lastSuccessAt: string | null
  consecutiveFailures: number
  lastError: string | null
  lastHttpStatus: number | null
  lastDurationMs: number | null
  lastItemCount: number
}

const COMMON_NEWSLETTERS = [
  { name: 'Morning Brew', domain: 'morningbrew.com' },
  { name: 'The Hustle', domain: 'thehustle.co' },
  { name: 'TLDR', domain: 'tldr.tech' },
  { name: 'Stratechery', domain: 'stratechery.com' },
  { name: 'Lenny\'s Newsletter', domain: 'substack.com' },
  { name: 'The Information', domain: 'theinformation.com' },
  { name: 'CB Insights', domain: 'cbinsights.com' },
  { name: 'Benedict Evans', domain: 'ben-evans.com' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newFeed, setNewFeed] = useState('')
  const [newSender, setNewSender] = useState('')
  const [newOverrideEmail, setNewOverrideEmail] = useState('')
  const [newOverrideName, setNewOverrideName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings(data)
        } else {
          const errorData = await res.json().catch(() => ({}))
          setLoadError(errorData.error || 'Failed to load settings')
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        setLoadError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const addRssFeed = async (feedUrl: string) => {
    if (!feedUrl.trim() || !settings) return
    const nextFeeds = Array.from(new Set([...settings.rssFeeds, feedUrl.trim()]))
    await updateSettings({ rssFeeds: nextFeeds })
    setNewFeed('')
  }

  const removeRssFeed = async (feedUrl: string) => {
    if (!settings) return
    const nextFeeds = settings.rssFeeds.filter((feed) => feed !== feedUrl)
    await updateSettings({ rssFeeds: nextFeeds })
  }

  const addSender = async (sender: string) => {
    if (!sender.trim()) return
    
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', sender: sender.trim() }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setNewSender('')
        showMessage('success', 'Newsletter source added')
      }
    } catch (error) {
      showMessage('error', 'Failed to add sender')
    }
  }

  const removeSender = async (sender: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', sender }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        showMessage('success', 'Newsletter source removed')
      }
    } catch (error) {
      showMessage('error', 'Failed to remove sender')
    }
  }

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        showMessage('success', 'Settings saved')
      }
    } catch (error) {
      showMessage('error', 'Failed to save settings')
    }
  }

  const toggleDigestDay = (day: 'monday' | 'wednesday') => {
    if (!settings) return
    const days = settings.digestDays.includes(day)
      ? settings.digestDays.filter((d) => d !== day)
      : [...settings.digestDays, day]
    updateSettings({ digestDays: days })
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const addOverride = () => {
    if (!newOverrideEmail.trim() || !newOverrideName.trim()) return
    if (!settings) return

    const newOverrides = {
      ...settings.senderOverrides,
      [newOverrideEmail.toLowerCase().trim()]: newOverrideName.trim(),
    }

    updateSettings({ senderOverrides: newOverrides })
    setNewOverrideEmail('')
    setNewOverrideName('')
  }

  const removeOverride = (email: string) => {
    if (!settings) return
    const newOverrides = { ...settings.senderOverrides }
    delete newOverrides[email]
    updateSettings({ senderOverrides: newOverrides })
  }

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
        <div className="glass-card p-6 max-w-lg w-full text-center">
          <h2 className="text-lg font-display font-bold mb-2">Unable to load settings</h2>
          <p className="text-sm text-ink-400">
            {loadError || 'The settings API returned no data.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen mesh-bg">
      {/* Header */}
      <header className="border-b border-ink-700/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-ink-800/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-ink-300" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-lg">Settings</h1>
            <p className="text-xs text-ink-400">Configure your newsletter digest</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Message Toast */}
        {message && (
          <div
            className={`fixed top-20 right-4 px-4 py-2 rounded-lg shadow-lg animate-slide-up ${
              message.type === 'success'
                ? 'bg-mint-500/20 border border-mint-500/30 text-mint-400'
                : 'bg-coral-500/20 border border-coral-500/30 text-coral-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Newsletter Sources */}
        <section className="glass-card p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Rss className="w-5 h-5 text-coral-500" />
            <h2 className="text-lg font-display font-bold">RSS Feeds</h2>
          </div>
          <p className="text-sm text-ink-400 mb-6">
            Add RSS/Atom feed URLs to ingest newsletters without email forwarding.
          </p>

          {/* Add new feed */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newFeed}
              onChange={(e) => setNewFeed(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRssFeed(newFeed)}
              placeholder="e.g., https://example.com/feed.xml"
              className="flex-1 px-4 py-2.5 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-coral-500/50 transition-colors"
            />
            <button
              onClick={() => addRssFeed(newFeed)}
              className="px-4 py-2.5 bg-coral-500 hover:bg-coral-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Current feeds */}
          {settings.rssFeeds.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                Active Feeds
              </h3>
              <div className="flex flex-wrap gap-2">
                {settings.rssFeeds.map((feedUrl) => (
                  <span
                    key={feedUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-800/50 border border-ink-700/50 rounded-full text-sm text-ink-200"
                  >
                    {feedUrl}
                    <button
                      onClick={() => removeRssFeed(feedUrl)}
                      className="p-0.5 hover:bg-ink-700/50 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-ink-400 hover:text-coral-500" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {settings.feedHealth && settings.feedHealth.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                Feed Health
              </h3>
              <div className="space-y-2">
                {settings.feedHealth.map((health) => (
                  <div
                    key={health.feedUrl}
                    className="p-3 bg-ink-800/30 border border-ink-700/30 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-200 truncate">{health.feedUrl}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          health.consecutiveFailures === 0
                            ? 'bg-mint-500/20 text-mint-400'
                            : 'bg-coral-500/20 text-coral-400'
                        }`}
                      >
                        {health.consecutiveFailures === 0 ? 'healthy' : `failures: ${health.consecutiveFailures}`}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-ink-400 flex flex-wrap gap-3">
                      <span>Last check: {new Date(health.lastCheckedAt).toLocaleString()}</span>
                      <span>Status: {health.lastHttpStatus ?? 'n/a'}</span>
                      <span>Items: {health.lastItemCount}</span>
                      <span>Latency: {health.lastDurationMs ?? 0} ms</span>
                    </div>
                    {health.lastError && (
                      <p className="mt-1 text-xs text-coral-400 truncate">{health.lastError}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick add popular newsletters */}
          <div>
            <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
              Feed Filters
            </h3>
            <p className="text-sm text-ink-500 mb-3">
              Optional: restrict ingested items by feed title/source. Enter domains or names.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSender}
                onChange={(e) => setNewSender(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSender(newSender)}
                placeholder="e.g., morningbrew or substack"
                className="flex-1 px-4 py-2.5 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-coral-500/50 transition-colors"
              />
              <button
                onClick={() => addSender(newSender)}
                className="px-4 py-2.5 bg-coral-500 hover:bg-coral-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMON_NEWSLETTERS.filter(
                (nl) => !settings.newsletterSenders.includes(nl.domain)
              ).map((nl) => (
                <button
                  key={nl.domain}
                  onClick={() => addSender(nl.domain)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-800/30 border border-ink-700/30 rounded-full text-sm text-ink-300 hover:border-mint-500/30 hover:text-mint-400 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {nl.name}
                </button>
              ))}
            </div>
            {settings.newsletterSenders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.newsletterSenders.map((sender) => (
                  <span
                    key={sender}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-800/50 border border-ink-700/50 rounded-full text-sm text-ink-200"
                  >
                    {sender}
                    <button
                      onClick={() => removeSender(sender)}
                      className="p-0.5 hover:bg-ink-700/50 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-ink-400 hover:text-coral-500" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Auto-Detection */}
        <section className="glass-card p-6 animate-slide-up stagger-1">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-display font-bold">Auto-Detection</h2>
          </div>
          <p className="text-sm text-ink-400 mb-4">
            When no feed filters are configured, include all items from your configured feeds.
          </p>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.autoDetect}
                onChange={(e) => updateSettings({ autoDetect: e.target.checked })}
                className="sr-only"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors ${
                  settings.autoDetect ? 'bg-mint-500' : 'bg-ink-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    settings.autoDetect ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </div>
            </div>
            <span className="text-ink-200">
              Include all feed items when no filters are configured
            </span>
          </label>
        </section>

        {/* Sender Overrides */}
        <section className="glass-card p-6 animate-slide-up stagger-2">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-mint-500" />
            <h2 className="text-lg font-display font-bold">Sender Display Names</h2>
          </div>
          <p className="text-sm text-ink-400 mb-6">
            Customize how feed sources are displayed in summaries and digest insights.
          </p>

          {/* Add new override */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
            <input
              type="text"
              value={newOverrideEmail}
              onChange={(e) => setNewOverrideEmail(e.target.value)}
              placeholder="Email or domain (e.g., newsletter@example.com)"
              className="px-4 py-2.5 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-mint-500/50 transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newOverrideName}
                onChange={(e) => setNewOverrideName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addOverride()}
                placeholder="Display name (e.g., Morning Brew)"
                className="flex-1 px-4 py-2.5 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 placeholder-ink-500 outline-none focus:border-mint-500/50 transition-colors"
              />
              <button
                onClick={addOverride}
                disabled={!newOverrideEmail.trim() || !newOverrideName.trim()}
                className="px-4 py-2.5 bg-mint-500 hover:bg-mint-600 text-ink-950 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Current overrides */}
          {settings.senderOverrides && Object.keys(settings.senderOverrides).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                Custom Display Names
              </h3>
              <div className="space-y-2">
                {Object.entries(settings.senderOverrides).map(([email, name]) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-ink-800/30 border border-ink-700/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Edit3 className="w-4 h-4 text-mint-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink-200 truncate">{name}</div>
                        <div className="text-xs text-ink-500 truncate">{email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeOverride(email)}
                      className="p-1.5 hover:bg-ink-700/50 rounded transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-ink-400 hover:text-coral-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.senderOverrides && Object.keys(settings.senderOverrides).length === 0 && (
            <div className="p-4 bg-ink-800/20 rounded-lg border border-ink-700/20 text-center">
              <p className="text-sm text-ink-500">
                No custom display names set. The app will use feed-provided source names.
              </p>
            </div>
          )}
        </section>

        {/* Scheduled Digests */}
        <section className="glass-card p-6 animate-slide-up stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-mint-500" />
            <h2 className="text-lg font-display font-bold">Scheduled Digests</h2>
          </div>
          <p className="text-sm text-ink-400 mb-6">
            Schedule when you want to run digest generation jobs.
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                Digest Days
              </h3>
              <div className="flex gap-3">
                {(['monday', 'wednesday'] as const).map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDigestDay(day)}
                    className={`px-4 py-2 rounded-lg border transition-colors capitalize ${
                      settings.digestDays.includes(day)
                        ? 'bg-mint-500/20 border-mint-500/30 text-mint-400'
                        : 'bg-ink-800/30 border-ink-700/30 text-ink-400 hover:border-ink-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink-400 uppercase tracking-wider mb-3">
                <Clock className="w-4 h-4 inline mr-1" />
                Delivery Time
              </h3>
              <input
                type="time"
                value={settings.digestTime}
                onChange={(e) => updateSettings({ digestTime: e.target.value })}
                className="px-4 py-2 bg-ink-800/50 border border-ink-700/50 rounded-lg text-ink-100 outline-none focus:border-coral-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-ink-800/30 rounded-lg border border-ink-700/20">
            <p className="text-sm text-ink-400">
              <span className="text-amber-500">Note:</span> Runtime scheduling is not enabled by default. Configure a cron job that calls your digest endpoint on selected days.
            </p>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="glass-card p-6 border-coral-500/20 animate-slide-up stagger-4">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-coral-500" />
            <h2 className="text-lg font-display font-bold text-coral-400">Reset Settings</h2>
          </div>
          <p className="text-sm text-ink-400 mb-4">
            Clear all your newsletter sources and reset to defaults.
          </p>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all settings?')) {
                updateSettings({
                  rssFeeds: [],
                  newsletterSenders: [],
                  senderOverrides: {},
                  autoDetect: true,
                  digestDays: ['monday', 'wednesday'],
                  digestTime: '08:00',
                })
              }
            }}
            className="px-4 py-2 bg-coral-500/10 border border-coral-500/30 text-coral-400 rounded-lg hover:bg-coral-500/20 transition-colors"
          >
            Reset All Settings
          </button>
        </section>
      </main>
    </div>
  )
}

