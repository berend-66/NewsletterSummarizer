import db, { ensureDatabaseInitialized } from './persistent-db'

export interface UserSettings {
  userId: string
  rssFeeds: string[]
  newsletterSenders: string[]
  senderOverrides: Record<string, string> // email/domain -> display name
  autoDetect: boolean
  digestDays: ('monday' | 'wednesday')[]
  digestTime: string // HH:mm format
  createdAt: string
  updatedAt: string
}

export interface FeedHealthMetric {
  feedUrl: string
  lastCheckedAt: string
  lastSuccessAt: string | null
  consecutiveFailures: number
  lastError: string | null
  lastHttpStatus: number | null
  lastDurationMs: number | null
  lastItemCount: number
}

interface FeedHealthUpdate {
  feedUrl: string
  checkedAt: string
  success: boolean
  durationMs: number
  itemCount: number
  statusCode?: number
  error?: string
}

export function getDefaultSettings(userId: string): UserSettings {
  return {
    userId,
    rssFeeds: [],
    newsletterSenders: [],
    senderOverrides: {},
    autoDetect: true,
    digestDays: ['monday', 'wednesday'],
    digestTime: '08:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function ensureUserSettingsRow(userId: string): Promise<void> {
  await ensureDatabaseInitialized()
  await db.query(
    `
      INSERT INTO user_settings (user_id, auto_detect, digest_days, digest_time)
      VALUES ($1, TRUE, $2::jsonb, '08:00')
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId, JSON.stringify(['monday', 'wednesday'])]
  )
}

function parseDigestDays(value: string): ('monday' | 'wednesday')[] {
  try {
    const parsed = JSON.parse(value)
    const allowed = new Set(['monday', 'wednesday'])
    if (!Array.isArray(parsed)) return ['monday', 'wednesday']
    const normalized = parsed.filter((day) => typeof day === 'string' && allowed.has(day))
    return normalized.length > 0 ? (normalized as ('monday' | 'wednesday')[]) : ['monday', 'wednesday']
  } catch {
    return ['monday', 'wednesday']
  }
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  await ensureUserSettingsRow(userId)

  const [settingsResult, feedsResult, filtersResult, overridesResult] = await Promise.all([
    db.query(
      `
        SELECT user_id, auto_detect, digest_days, digest_time, created_at, updated_at
        FROM user_settings
        WHERE user_id = $1
      `,
      [userId]
    ),
    db.query(
      `
        SELECT feed_url FROM user_feeds
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    ),
    db.query(
      `
        SELECT filter_value FROM user_feed_filters
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    ),
    db.query(
      `
        SELECT sender_key, display_name FROM user_sender_overrides
        WHERE user_id = $1
        ORDER BY updated_at DESC
      `,
      [userId]
    ),
  ])

  const settingsRow = settingsResult.rows[0] as
    | {
        user_id: string
        auto_detect: boolean
        digest_days: unknown
        digest_time: string
        created_at: string | Date
        updated_at: string | Date
      }
    | undefined

  if (!settingsRow) {
    return getDefaultSettings(userId)
  }

  const feeds = (feedsResult.rows as { feed_url: string }[]).map((row) => row.feed_url)
  const filters = (filtersResult.rows as { filter_value: string }[]).map((row) => row.filter_value)
  const overridesRows = overridesResult.rows as { sender_key: string; display_name: string }[]
  const senderOverrides = overridesRows.reduce<Record<string, string>>((acc, row) => {
    acc[row.sender_key] = row.display_name
    return acc
  }, {})

  const digestDaysRaw =
    typeof settingsRow.digest_days === 'string'
      ? settingsRow.digest_days
      : JSON.stringify(settingsRow.digest_days)

  return {
    userId: settingsRow.user_id,
    rssFeeds: feeds,
    newsletterSenders: filters,
    senderOverrides,
    autoDetect: settingsRow.auto_detect,
    digestDays: parseDigestDays(digestDaysRaw),
    digestTime: settingsRow.digest_time,
    createdAt:
      settingsRow.created_at instanceof Date
        ? settingsRow.created_at.toISOString()
        : settingsRow.created_at,
    updatedAt:
      settingsRow.updated_at instanceof Date
        ? settingsRow.updated_at.toISOString()
        : settingsRow.updated_at,
  }
}

export async function updateUserSettings(
  userId: string,
  updates: Partial<Omit<UserSettings, 'userId' | 'createdAt'>>
): Promise<UserSettings> {
  await ensureUserSettingsRow(userId)

  const nowIso = new Date().toISOString()
  const current = await getUserSettings(userId)

  const next = {
    ...current,
    ...updates,
    updatedAt: nowIso,
  }

  await db.query(
    `
      UPDATE user_settings
      SET auto_detect = $1, digest_days = $2::jsonb, digest_time = $3, updated_at = $4::timestamptz
      WHERE user_id = $5
    `,
    [next.autoDetect, JSON.stringify(next.digestDays), next.digestTime, nowIso, userId]
  )

  if (updates.rssFeeds) {
    await db.query('DELETE FROM user_feeds WHERE user_id = $1', [userId])
    for (const feedUrl of next.rssFeeds) {
      await db.query(
        `
          INSERT INTO user_feeds (user_id, feed_url, created_at)
          VALUES ($1, $2, $3::timestamptz)
          ON CONFLICT (user_id, feed_url) DO NOTHING
        `,
        [userId, feedUrl.trim(), nowIso]
      )
    }
  }

  if (updates.newsletterSenders) {
    await db.query('DELETE FROM user_feed_filters WHERE user_id = $1', [userId])
    for (const filter of next.newsletterSenders) {
      await db.query(
        `
          INSERT INTO user_feed_filters (user_id, filter_value, created_at)
          VALUES ($1, $2, $3::timestamptz)
          ON CONFLICT (user_id, filter_value) DO NOTHING
        `,
        [userId, filter.toLowerCase().trim(), nowIso]
      )
    }
  }

  if (updates.senderOverrides) {
    await db.query('DELETE FROM user_sender_overrides WHERE user_id = $1', [userId])
    for (const [senderKey, displayName] of Object.entries(next.senderOverrides)) {
      await db.query(
        `
          INSERT INTO user_sender_overrides
          (user_id, sender_key, display_name, created_at, updated_at)
          VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
          ON CONFLICT (user_id, sender_key) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            updated_at = EXCLUDED.updated_at
        `,
        [userId, senderKey.toLowerCase().trim(), displayName.trim(), nowIso, nowIso]
      )
    }
  }

  return await getUserSettings(userId)
}

export async function addNewsletterSender(userId: string, sender: string): Promise<UserSettings> {
  const normalized = sender.toLowerCase().trim()
  if (!normalized) return await getUserSettings(userId)

  await ensureUserSettingsRow(userId)
  await db.query(
    `
      INSERT INTO user_feed_filters (user_id, filter_value)
      VALUES ($1, $2)
      ON CONFLICT (user_id, filter_value) DO NOTHING
    `,
    [userId, normalized]
  )

  await db.query(`UPDATE user_settings SET updated_at = $1::timestamptz WHERE user_id = $2`, [
    new Date().toISOString(),
    userId,
  ])

  return await getUserSettings(userId)
}

export async function removeNewsletterSender(
  userId: string,
  sender: string
): Promise<UserSettings> {
  const normalized = sender.toLowerCase().trim()
  await ensureUserSettingsRow(userId)

  await db.query(
    `
      DELETE FROM user_feed_filters
      WHERE user_id = $1 AND filter_value = $2
    `,
    [userId, normalized]
  )

  await db.query(`UPDATE user_settings SET updated_at = $1::timestamptz WHERE user_id = $2`, [
    new Date().toISOString(),
    userId,
  ])

  return await getUserSettings(userId)
}

export async function upsertFeedHealthMetric(
  userId: string,
  metric: FeedHealthUpdate
): Promise<void> {
  await ensureUserSettingsRow(userId)

  const previousResult = await db.query(
    `
      SELECT consecutive_failures
      FROM feed_health
      WHERE user_id = $1 AND feed_url = $2
    `,
    [userId, metric.feedUrl]
  )
  const previous = previousResult.rows[0] as { consecutive_failures: number } | undefined

  const nextFailures = metric.success ? 0 : (previous?.consecutive_failures || 0) + 1

  await db.query(
    `
      INSERT INTO feed_health (
        user_id, feed_url, last_checked_at, last_success_at, consecutive_failures,
        last_error, last_http_status, last_duration_ms, last_item_count, updated_at
      ) VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, $10::timestamptz)
      ON CONFLICT (user_id, feed_url) DO UPDATE SET
        last_checked_at = EXCLUDED.last_checked_at,
        last_success_at = EXCLUDED.last_success_at,
        consecutive_failures = EXCLUDED.consecutive_failures,
        last_error = EXCLUDED.last_error,
        last_http_status = EXCLUDED.last_http_status,
        last_duration_ms = EXCLUDED.last_duration_ms,
        last_item_count = EXCLUDED.last_item_count,
        updated_at = EXCLUDED.updated_at
    `,
    [
      userId,
      metric.feedUrl,
      metric.checkedAt,
      metric.success ? metric.checkedAt : null,
      nextFailures,
      metric.error || null,
      metric.statusCode ?? null,
      metric.durationMs,
      metric.itemCount,
      metric.checkedAt,
    ]
  )
}

export async function getFeedHealthMetrics(userId: string): Promise<FeedHealthMetric[]> {
  await ensureUserSettingsRow(userId)
  const result = await db.query(
    `
      SELECT
        feed_url,
        last_checked_at,
        last_success_at,
        consecutive_failures,
        last_error,
        last_http_status,
        last_duration_ms,
        last_item_count
      FROM feed_health
      WHERE user_id = $1
      ORDER BY last_checked_at DESC
    `,
    [userId]
  )
  const rows = result.rows as Array<{
    feed_url: string
    last_checked_at: string | Date
    last_success_at: string | Date | null
    consecutive_failures: number
    last_error: string | null
    last_http_status: number | null
    last_duration_ms: number | null
    last_item_count: number
  }>

  return rows.map((row) => ({
    feedUrl: row.feed_url,
    lastCheckedAt:
      row.last_checked_at instanceof Date ? row.last_checked_at.toISOString() : row.last_checked_at,
    lastSuccessAt:
      row.last_success_at instanceof Date
        ? row.last_success_at.toISOString()
        : row.last_success_at,
    consecutiveFailures: row.consecutive_failures,
    lastError: row.last_error,
    lastHttpStatus: row.last_http_status,
    lastDurationMs: row.last_duration_ms,
    lastItemCount: row.last_item_count,
  }))
}

export async function getUsersWithFeeds(): Promise<string[]> {
  await ensureDatabaseInitialized()
  const result = await db.query(`
    SELECT DISTINCT user_id
    FROM user_feeds
    ORDER BY user_id ASC
  `)
  return (result.rows as { user_id: string }[]).map((row) => row.user_id)
}

