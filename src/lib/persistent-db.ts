import Database from 'better-sqlite3'
import path from 'path'
import { Pool } from 'pg'

export type DatabaseProvider = 'postgres' | 'sqlite'

let pgPool: Pool | null = null
let sqliteDb: Database.Database | null = null
let initialized = false

function resolveProvider(): DatabaseProvider {
  if (process.env.DB_PROVIDER === 'sqlite') return 'sqlite'
  if (process.env.DB_PROVIDER === 'postgres') return 'postgres'
  if (process.env.DATABASE_URL) return 'postgres'
  return 'sqlite'
}

export const databaseProvider = resolveProvider()

function getPgPool(): Pool {
  if (pgPool) return pgPool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when DB_PROVIDER=postgres')
  }

  const useSsl =
    process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')

  pgPool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  })

  return pgPool
}

function getSqliteDb(): Database.Database {
  if (sqliteDb) return sqliteDb
  const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'newsletter.db')
  sqliteDb = new Database(dbPath)
  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('foreign_keys = ON')
  return sqliteDb
}

function sqliteValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}

function convertPgStyleToSqlite(
  queryText: string,
  values: unknown[] = []
): { sql: string; params: unknown[] } {
  const params: unknown[] = []
  let sql = queryText
    .replace(/\$(\d+)/g, (_match, group: string) => {
      params.push(sqliteValue(values[Number(group) - 1]))
      return '?'
    })
    .replace(/::jsonb/gi, '')
    .replace(/::timestamptz/gi, '')
    .replace(/::vector/gi, '')
    .replace(/::int\b/gi, '')

  sql = sql.replace(
    /\bNOW\(\)\s*-\s*\(\s*\?\s*\*\s*INTERVAL\s+'1 day'\s*\)/gi,
    "datetime('now', '-' || ? || ' days')"
  )

  sql = sql
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\bTRUE\b/gi, '1')
    .replace(/\bFALSE\b/gi, '0')

  return { sql, params }
}

async function initPostgres(): Promise<void> {
  const activePool = getPgPool()

  let hasVector = false
  try {
    await activePool.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
    hasVector = true
  } catch (error) {
    console.warn('pgvector extension is not available; embeddings table will use TEXT fallback')
  }

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      auto_detect BOOLEAN NOT NULL DEFAULT TRUE,
      digest_days JSONB NOT NULL DEFAULT '["monday","wednesday"]'::jsonb,
      digest_time TEXT NOT NULL DEFAULT '08:00',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_feeds (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, feed_url),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_feed_filters (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      filter_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, filter_value),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_sender_overrides (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      sender_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, sender_key),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feed_health (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      last_checked_at TIMESTAMPTZ NOT NULL,
      last_success_at TIMESTAMPTZ,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_http_status INTEGER,
      last_duration_ms INTEGER,
      last_item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, feed_url),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS summaries (
      email_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      newsletter_subject TEXT,
      sender_name TEXT,
      sender_email TEXT,
      received_at TIMESTAMPTZ,
      summary TEXT,
      key_points JSONB,
      topics JSONB,
      sentiment TEXT,
      read_time INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (email_id, user_email)
    );

    CREATE INDEX IF NOT EXISTS idx_summaries_user_email ON summaries(user_email);
    CREATE INDEX IF NOT EXISTS idx_summaries_received_at ON summaries(received_at);
    CREATE INDEX IF NOT EXISTS idx_feed_health_user ON feed_health(user_id);
  `)

  const embeddingType = hasVector ? 'VECTOR(1536)' : 'TEXT'
  try {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS item_embeddings (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        email_id TEXT NOT NULL,
        model TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding ${embeddingType} NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, email_id)
      );
      CREATE INDEX IF NOT EXISTS idx_item_embeddings_user ON item_embeddings(user_id);
    `)
  } catch (error) {
    console.warn('Could not create item_embeddings table:', error)
  }

  if (hasVector) {
    try {
      await activePool.query(`
        CREATE INDEX IF NOT EXISTS idx_item_embeddings_embedding
        ON item_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `)
    } catch (error) {
      console.warn('Could not create pgvector ivfflat index:', error)
    }
  }
}

function initSqlite(): void {
  const db = getSqliteDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      auto_detect INTEGER NOT NULL DEFAULT 1,
      digest_days TEXT NOT NULL DEFAULT '["monday","wednesday"]',
      digest_time TEXT NOT NULL DEFAULT '08:00',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, feed_url),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_feed_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      filter_value TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, filter_value),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_sender_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      sender_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, sender_key),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feed_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      last_checked_at TEXT NOT NULL,
      last_success_at TEXT,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_http_status INTEGER,
      last_duration_ms INTEGER,
      last_item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, feed_url),
      FOREIGN KEY(user_id) REFERENCES user_settings(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS summaries (
      email_id TEXT NOT NULL,
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
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (email_id, user_email)
    );

    CREATE TABLE IF NOT EXISTS item_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      model TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, email_id)
    );

    CREATE INDEX IF NOT EXISTS idx_summaries_user_email ON summaries(user_email);
    CREATE INDEX IF NOT EXISTS idx_summaries_received_at ON summaries(received_at);
    CREATE INDEX IF NOT EXISTS idx_feed_health_user ON feed_health(user_id);
    CREATE INDEX IF NOT EXISTS idx_item_embeddings_user ON item_embeddings(user_id);
  `)
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (initialized) return
  if (databaseProvider === 'postgres') {
    await initPostgres()
  } else {
    initSqlite()
  }
  initialized = true
}

const db = {
  query: async (queryText: string, values?: unknown[]) => {
    await ensureDatabaseInitialized()

    if (databaseProvider === 'postgres') {
      return getPgPool().query(queryText, values)
    }

    const sqlite = getSqliteDb()
    const converted = convertPgStyleToSqlite(queryText, values)
    const normalized = converted.sql.trim().toLowerCase()

    if (normalized.startsWith('select')) {
      const statement = sqlite.prepare(converted.sql)
      const rows = statement.all(...converted.params) as any[]
      return { rows, rowCount: rows.length }
    }

    const statement = sqlite.prepare(converted.sql)
    const result = statement.run(...converted.params)
    return { rows: [], rowCount: result.changes }
  },
}

export default db
