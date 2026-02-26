import { Pool } from 'pg'

let pool: Pool | null = null

let initialized = false

function getPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Postgres persistence')
  }

  const useSsl =
    process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')

  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  })

  return pool
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (initialized) return
  const activePool = getPool()

  try {
    await activePool.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
  } catch (error) {
    console.warn('pgvector extension is not available:', error)
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

  await activePool.query(`
    CREATE TABLE IF NOT EXISTS item_embeddings (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email_id TEXT NOT NULL,
      model TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding VECTOR(1536) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, email_id)
    );

    CREATE INDEX IF NOT EXISTS idx_item_embeddings_user ON item_embeddings(user_id);
  `)

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

  initialized = true
}

const db = {
  query: async (queryText: string, values?: unknown[]) => {
    const activePool = getPool()
    return activePool.query(queryText, values)
  },
}

export default db
