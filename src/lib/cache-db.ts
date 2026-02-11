import Database from 'better-sqlite3'
import path from 'path'
import { NewsletterSummary } from './ollama-summarizer'

// Initialize database
const dbPath = path.join(process.cwd(), 'newsletter-cache.db')
const db = new Database(dbPath)

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS summaries (
    email_id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    newsletter_subject TEXT,
    sender_name TEXT,
    sender_email TEXT,
    received_at TEXT,
    summary TEXT,
    key_points TEXT,
    topics TEXT,
    sentiment TEXT,
    read_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_user_email ON summaries(user_email);
  CREATE INDEX IF NOT EXISTS idx_received_at ON summaries(received_at);
`)

export interface CachedSummary extends NewsletterSummary {
  cachedAt?: string
}

/**
 * Get a cached summary by email ID and user email
 */
export function getCachedSummary(emailId: string, userEmail: string): CachedSummary | null {
  const stmt = db.prepare(`
    SELECT * FROM summaries 
    WHERE email_id = ? AND user_email = ?
  `)
  
  const row = stmt.get(emailId, userEmail) as any
  
  if (!row) return null
  
  return {
    id: row.email_id,
    subject: row.newsletter_subject,
    sender: row.sender_name,
    senderEmail: row.sender_email,
    receivedAt: row.received_at,
    summary: row.summary,
    keyPoints: JSON.parse(row.key_points || '[]'),
    topics: JSON.parse(row.topics || '[]'),
    sentiment: row.sentiment as 'positive' | 'neutral' | 'negative',
    readTime: row.read_time,
    cachedAt: row.created_at,
  }
}

/**
 * Save a summary to cache
 */
export function cacheSummary(summary: NewsletterSummary, userEmail: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO summaries (
      email_id, user_email, newsletter_subject, sender_name, sender_email,
      received_at, summary, key_points, topics, sentiment, read_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  stmt.run(
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
    summary.readTime
  )
}

/**
 * Get all cached summaries for a user
 */
export function getAllCachedSummaries(userEmail: string): CachedSummary[] {
  const stmt = db.prepare(`
    SELECT * FROM summaries 
    WHERE user_email = ?
    ORDER BY received_at DESC
  `)
  
  const rows = stmt.all(userEmail) as any[]
  
  return rows.map(row => ({
    id: row.email_id,
    subject: row.newsletter_subject,
    sender: row.sender_name,
    senderEmail: row.sender_email,
    receivedAt: row.received_at,
    summary: row.summary,
    keyPoints: JSON.parse(row.key_points || '[]'),
    topics: JSON.parse(row.topics || '[]'),
    sentiment: row.sentiment as 'positive' | 'neutral' | 'negative',
    readTime: row.read_time,
    cachedAt: row.created_at,
  }))
}

/**
 * Clear old cached summaries (older than X days)
 */
export function clearOldCache(daysToKeep: number = 90): number {
  const stmt = db.prepare(`
    DELETE FROM summaries 
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `)
  
  const result = stmt.run(daysToKeep)
  return result.changes
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM summaries')
  const userStmt = db.prepare('SELECT COUNT(DISTINCT user_email) as count FROM summaries')
  
  const total = (totalStmt.get() as any).count
  const users = (userStmt.get() as any).count
  
  return {
    totalSummaries: total,
    uniqueUsers: users,
  }
}

export default db
