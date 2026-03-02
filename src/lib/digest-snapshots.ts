import db, { ensureDatabaseInitialized } from './persistent-db'

export interface PersistedCombinedDigest {
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

interface SaveDigestSnapshotInput {
  userId: string
  daysBack: number
  provider: 'openai' | 'ollama'
  model: string | null
  digest: PersistedCombinedDigest
  sourceRunId?: number
}

export interface DigestSnapshotRecord {
  id: number
  userId: string
  daysBack: number
  provider: string
  model: string | null
  totalNewsletters: number
  digest: PersistedCombinedDigest
  sourceRunId: number | null
  createdAt: string
}

function parseDigestPayload(value: unknown): PersistedCombinedDigest | null {
  if (!value) return null

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed as PersistedCombinedDigest
    } catch {
      return null
    }
  }

  if (typeof value === 'object') {
    return value as PersistedCombinedDigest
  }

  return null
}

export async function saveDigestSnapshot(input: SaveDigestSnapshotInput): Promise<void> {
  await ensureDatabaseInitialized()
  const nowIso = new Date().toISOString()

  await db.query(
    `
      INSERT INTO digest_snapshots (
        user_id,
        days_back,
        provider,
        model,
        total_newsletters,
        digest_payload,
        source_run_id,
        created_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7,
        $8::timestamptz
      )
    `,
    [
      input.userId,
      input.daysBack,
      input.provider,
      input.model,
      input.digest.totalNewsletters,
      JSON.stringify(input.digest),
      input.sourceRunId ?? null,
      nowIso,
    ]
  )
}

export async function getLatestDigestSnapshot(
  userId: string,
  daysBack: number
): Promise<DigestSnapshotRecord | null> {
  await ensureDatabaseInitialized()

  const result = await db.query(
    `
      SELECT
        id,
        user_id,
        days_back,
        provider,
        model,
        total_newsletters,
        digest_payload,
        source_run_id,
        created_at
      FROM digest_snapshots
      WHERE user_id = $1 AND days_back = $2
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId, daysBack]
  )

  const row = result.rows[0] as
    | {
        id: number
        user_id: string
        days_back: number
        provider: string
        model: string | null
        total_newsletters: number
        digest_payload: unknown
        source_run_id: number | null
        created_at: string | Date
      }
    | undefined

  if (!row) return null

  const digest = parseDigestPayload(row.digest_payload)
  if (!digest) return null

  return {
    id: row.id,
    userId: row.user_id,
    daysBack: row.days_back,
    provider: row.provider,
    model: row.model,
    totalNewsletters: row.total_newsletters,
    digest,
    sourceRunId: row.source_run_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }
}
