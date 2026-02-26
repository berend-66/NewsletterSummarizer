import OpenAI from 'openai'
import db, { ensureDatabaseInitialized } from './persistent-db'
import type { NewsletterSummary } from './ollama-summarizer'

const EMBEDDING_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for semantic embeddings')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export function isSemanticSearchConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

async function generateEmbedding(input: string): Promise<number[]> {
  const openai = getOpenAIClient()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  })

  const vector = response.data[0]?.embedding
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${vector?.length || 0}`
    )
  }

  return vector
}

export async function upsertSummaryEmbedding(
  summary: NewsletterSummary,
  userId: string
): Promise<void> {
  if (!isSemanticSearchConfigured()) return

  await ensureDatabaseInitialized()

  const existing = await db.query(
    `
      SELECT id FROM item_embeddings
      WHERE user_id = $1 AND email_id = $2
      LIMIT 1
    `,
    [userId, summary.id]
  )

  if ((existing.rowCount || 0) > 0) {
    return
  }

  const content = [
    `Subject: ${summary.subject}`,
    `Sender: ${summary.sender}`,
    `Summary: ${summary.summary}`,
    `Key points: ${summary.keyPoints.join('; ')}`,
    `Topics: ${summary.topics.join(', ')}`,
  ].join('\n')

  const embedding = await generateEmbedding(content)
  const embeddingLiteral = toVectorLiteral(embedding)

  await db.query(
    `
      INSERT INTO item_embeddings (user_id, email_id, model, content, embedding)
      VALUES ($1, $2, $3, $4, $5::vector)
      ON CONFLICT (user_id, email_id) DO UPDATE SET
        model = EXCLUDED.model,
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `,
    [userId, summary.id, EMBEDDING_MODEL, content, embeddingLiteral]
  )
}

export interface SemanticSearchResult {
  id: string
  subject: string
  sender: string
  senderEmail: string
  receivedAt: string
  summary: string
  similarity: number
}

export async function semanticSearchSummaries(
  query: string,
  userId: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  if (!isSemanticSearchConfigured()) {
    throw new Error('Semantic search is not configured (set OPENAI_API_KEY)')
  }

  await ensureDatabaseInitialized()
  const queryEmbedding = await generateEmbedding(query)
  const queryVectorLiteral = toVectorLiteral(queryEmbedding)

  const result = await db.query(
    `
      SELECT
        s.email_id,
        s.newsletter_subject,
        s.sender_name,
        s.sender_email,
        s.received_at,
        s.summary,
        (1 - (ie.embedding <=> $2::vector)) AS similarity
      FROM item_embeddings ie
      INNER JOIN summaries s
        ON s.email_id = ie.email_id
       AND s.user_email = ie.user_id
      WHERE ie.user_id = $1
      ORDER BY ie.embedding <=> $2::vector
      LIMIT $3
    `,
    [userId, queryVectorLiteral, limit]
  )

  return result.rows.map((row) => ({
    id: row.email_id as string,
    subject: row.newsletter_subject as string,
    sender: row.sender_name as string,
    senderEmail: row.sender_email as string,
    receivedAt:
      row.received_at instanceof Date ? row.received_at.toISOString() : (row.received_at as string),
    summary: row.summary as string,
    similarity: Number(row.similarity || 0),
  }))
}
