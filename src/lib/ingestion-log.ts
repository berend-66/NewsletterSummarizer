import db, { databaseProvider, ensureDatabaseInitialized } from './persistent-db'
import type { CanonicalNewsletter } from './newsletter-model'

export type IngestionTrigger = 'manual' | 'cron'
type IngestionRunStatus = 'running' | 'succeeded' | 'failed'

interface StartIngestionRunInput {
  userId: string
  triggerType: IngestionTrigger
  daysBack: number
  feedCount: number
}

interface CompleteIngestionRunInput {
  runId: number
  status: Exclude<IngestionRunStatus, 'running'>
  newsletterCount: number
  summarizedCount: number
  errorText?: string
}

export async function startIngestionRun(input: StartIngestionRunInput): Promise<number> {
  await ensureDatabaseInitialized()
  const nowIso = new Date().toISOString()

  if (databaseProvider === 'postgres') {
    const result = await db.query(
      `
        INSERT INTO ingestion_runs (
          user_id, trigger_type, days_back, feed_count, status, started_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'running', $5::timestamptz, $6::timestamptz, $7::timestamptz)
        RETURNING id
      `,
      [input.userId, input.triggerType, input.daysBack, input.feedCount, nowIso, nowIso, nowIso]
    )
    return Number((result.rows[0] as { id: number }).id)
  }

  await db.query(
    `
      INSERT INTO ingestion_runs (
        user_id, trigger_type, days_back, feed_count, status, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'running', $5::timestamptz, $6::timestamptz, $7::timestamptz)
    `,
    [input.userId, input.triggerType, input.daysBack, input.feedCount, nowIso, nowIso, nowIso]
  )

  const idResult = await db.query(`SELECT last_insert_rowid() AS id`)
  return Number((idResult.rows[0] as { id: number }).id)
}

export async function completeIngestionRun(input: CompleteIngestionRunInput): Promise<void> {
  await ensureDatabaseInitialized()
  const nowIso = new Date().toISOString()

  await db.query(
    `
      UPDATE ingestion_runs
      SET
        status = $1,
        newsletter_count = $2,
        summarized_count = $3,
        error_text = $4,
        completed_at = $5::timestamptz,
        updated_at = $6::timestamptz
      WHERE id = $7
    `,
    [
      input.status,
      input.newsletterCount,
      input.summarizedCount,
      input.errorText || null,
      nowIso,
      nowIso,
      input.runId,
    ]
  )
}

export async function persistNewsletterItems(
  userId: string,
  newsletters: CanonicalNewsletter[],
  runId: number
): Promise<void> {
  await ensureDatabaseInitialized()
  const nowIso = new Date().toISOString()

  for (const newsletter of newsletters) {
    await db.query(
      `
        INSERT INTO newsletter_items (
          user_id,
          item_id,
          subject,
          sender_name,
          sender_email,
          received_at,
          body_preview,
          body_content,
          body_content_type,
          source_type,
          feed_url,
          feed_title,
          item_guid,
          item_link,
          dedupe_key,
          first_seen_at,
          last_seen_at,
          last_ingestion_run_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::timestamptz,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16::timestamptz,
          $17::timestamptz,
          $18,
          $19::timestamptz,
          $20::timestamptz
        )
        ON CONFLICT (user_id, item_id) DO UPDATE SET
          subject = EXCLUDED.subject,
          sender_name = EXCLUDED.sender_name,
          sender_email = EXCLUDED.sender_email,
          received_at = EXCLUDED.received_at,
          body_preview = EXCLUDED.body_preview,
          body_content = EXCLUDED.body_content,
          body_content_type = EXCLUDED.body_content_type,
          source_type = EXCLUDED.source_type,
          feed_url = EXCLUDED.feed_url,
          feed_title = EXCLUDED.feed_title,
          item_guid = EXCLUDED.item_guid,
          item_link = EXCLUDED.item_link,
          dedupe_key = EXCLUDED.dedupe_key,
          last_seen_at = EXCLUDED.last_seen_at,
          last_ingestion_run_id = EXCLUDED.last_ingestion_run_id,
          updated_at = EXCLUDED.updated_at
      `,
      [
        userId,
        newsletter.id,
        newsletter.subject,
        newsletter.from.emailAddress.name,
        newsletter.from.emailAddress.address,
        newsletter.receivedDateTime,
        newsletter.bodyPreview,
        newsletter.body.content,
        newsletter.body.contentType,
        newsletter.source.type,
        newsletter.source.feedUrl,
        newsletter.source.feedTitle || null,
        newsletter.source.itemGuid || null,
        newsletter.source.itemLink || null,
        newsletter.source.dedupeKey,
        nowIso,
        nowIso,
        runId,
        nowIso,
        nowIso,
      ]
    )
  }
}
