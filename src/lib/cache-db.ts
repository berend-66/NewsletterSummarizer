import type { NewsletterSummary } from './ollama-summarizer'
import db, { ensureDatabaseInitialized } from './persistent-db'

export interface CachedSummary extends NewsletterSummary {
  cachedAt?: string
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function rowToCachedSummary(row: any): CachedSummary {
  return {
    id: row.email_id,
    subject: row.newsletter_subject,
    sender: row.sender_name,
    senderEmail: row.sender_email,
    receivedAt: row.received_at,
    summary: row.summary,
    keyPoints: parseJsonArray(row.key_points),
    topics: parseJsonArray(row.topics),
    sentiment: row.sentiment as 'positive' | 'neutral' | 'negative',
    readTime: row.read_time,
    cachedAt: row.created_at?.toISOString?.() || row.created_at,
  }
}

/**
 * Get a cached summary by email ID and user email
 */
export async function getCachedSummary(
  emailId: string,
  userEmail: string
): Promise<CachedSummary | null> {
  await ensureDatabaseInitialized()

  const result = await db.query(
    `
      SELECT * FROM summaries
      WHERE email_id = $1 AND user_email = $2
      LIMIT 1
    `,
    [emailId, userEmail]
  )

  const row = result.rows[0] as any
  if (!row) return null
  
  return rowToCachedSummary(row)
}

/**
 * Save a summary to cache
 */
export async function cacheSummary(summary: NewsletterSummary, userEmail: string): Promise<void> {
  await ensureDatabaseInitialized()
  await db.query(
    `
      INSERT INTO summaries (
        email_id, user_email, newsletter_subject, sender_name, sender_email,
        received_at, summary, key_points, topics, sentiment, read_time
      ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb, $9::jsonb, $10, $11)
      ON CONFLICT (email_id, user_email) DO UPDATE SET
        newsletter_subject = EXCLUDED.newsletter_subject,
        sender_name = EXCLUDED.sender_name,
        sender_email = EXCLUDED.sender_email,
        received_at = EXCLUDED.received_at,
        summary = EXCLUDED.summary,
        key_points = EXCLUDED.key_points,
        topics = EXCLUDED.topics,
        sentiment = EXCLUDED.sentiment,
        read_time = EXCLUDED.read_time
    `,
    [
      summary.id,
      userEmail,
      summary.subject,
      summary.sender,
      summary.senderEmail,
      summary.receivedAt,
      summary.summary,
      JSON.stringify(summary.keyPoints),
      JSON.stringify(summary.topics),
      summary.sentiment,
      summary.readTime,
    ]
  )
}

/**
 * Get all cached summaries for a user
 */
export async function getAllCachedSummaries(userEmail: string): Promise<CachedSummary[]> {
  await ensureDatabaseInitialized()
  const result = await db.query(
    `
      SELECT * FROM summaries
      WHERE user_email = $1
      ORDER BY received_at DESC
    `,
    [userEmail]
  )
  const rows = result.rows as any[]

  return rows.map((row) => rowToCachedSummary(row))
}

/**
 * Get cached summaries for a rolling time window.
 */
export async function getCachedSummariesForWindow(
  userEmail: string,
  daysBack: number
): Promise<CachedSummary[]> {
  await ensureDatabaseInitialized()

  const result = await db.query(
    `
      SELECT * FROM summaries
      WHERE user_email = $1
        AND received_at >= NOW() - ($2 * INTERVAL '1 day')
      ORDER BY received_at DESC
    `,
    [userEmail, daysBack]
  )

  const rows = result.rows as any[]
  return rows.map((row) => rowToCachedSummary(row))
}

/**
 * Clear old cached summaries (older than X days)
 */
export async function clearOldCache(daysToKeep: number = 90): Promise<number> {
  await ensureDatabaseInitialized()
  const result = await db.query(
    `
      DELETE FROM summaries
      WHERE created_at < NOW() - ($1 * INTERVAL '1 day')
    `,
    [daysToKeep]
  )
  return result.rowCount || 0
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ totalSummaries: number; uniqueUsers: number }> {
  await ensureDatabaseInitialized()
  const [totalResult, usersResult] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM summaries'),
    db.query('SELECT COUNT(DISTINCT user_email)::int AS count FROM summaries'),
  ])

  const total = totalResult.rows[0]?.count || 0
  const users = usersResult.rows[0]?.count || 0

  return {
    totalSummaries: total,
    uniqueUsers: users,
  }
}

export default db
