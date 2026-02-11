// Simple in-memory storage for user settings
// In production, you'd want to use a database

export interface UserSettings {
  userId: string
  newsletterSenders: string[]
  senderOverrides: Record<string, string> // email/domain -> display name
  autoDetect: boolean
  digestDays: ('monday' | 'wednesday')[]
  digestTime: string // HH:mm format
  createdAt: string
  updatedAt: string
}

// In-memory storage (will reset on server restart)
// Replace with database in production
const settingsStore = new Map<string, UserSettings>()

export function getDefaultSettings(userId: string): UserSettings {
  return {
    userId,
    newsletterSenders: [],
    senderOverrides: {},
    autoDetect: true,
    digestDays: ['monday', 'wednesday'],
    digestTime: '08:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function getUserSettings(userId: string): UserSettings {
  const settings = settingsStore.get(userId)
  if (!settings) {
    const defaultSettings = getDefaultSettings(userId)
    settingsStore.set(userId, defaultSettings)
    return defaultSettings
  }
  return settings
}

export function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'userId' | 'createdAt'>>
): UserSettings {
  const current = getUserSettings(userId)
  const updated: UserSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  settingsStore.set(userId, updated)
  return updated
}

export function addNewsletterSender(userId: string, sender: string): UserSettings {
  const settings = getUserSettings(userId)
  if (!settings.newsletterSenders.includes(sender.toLowerCase())) {
    settings.newsletterSenders.push(sender.toLowerCase())
    settings.updatedAt = new Date().toISOString()
    settingsStore.set(userId, settings)
  }
  return settings
}

export function removeNewsletterSender(userId: string, sender: string): UserSettings {
  const settings = getUserSettings(userId)
  settings.newsletterSenders = settings.newsletterSenders.filter(
    (s) => s !== sender.toLowerCase()
  )
  settings.updatedAt = new Date().toISOString()
  settingsStore.set(userId, settings)
  return settings
}

