import type { CanonicalNewsletter } from './newsletter-model'
import {
  summarizeNewsletters as openaiSummarize,
  generateCombinedDigest as openaiGenerateCombinedDigest,
} from './openai-summarizer'
import type { NewsletterSummary as OpenaiNewsletterSummary } from './openai-summarizer'
import {
  summarizeNewsletters as ollamaSummarize,
  generateCombinedDigest as ollamaGenerateCombinedDigest,
} from './ollama-summarizer'
import type { NewsletterSummary } from './ollama-summarizer'
import { cacheSummary, getCachedSummary } from './cache-db'
import { upsertSummaryEmbedding } from './semantic-search'
import {
  getLatestDigestSnapshot,
  saveDigestSnapshot,
  PersistedCombinedDigest,
} from './digest-snapshots'

export type SummaryProvider = 'openai' | 'ollama'

export interface IncrementalAnalysisInput {
  newsletters: CanonicalNewsletter[]
  userId: string
  daysBack: number
  senderOverrides?: Record<string, string>
  sourceRunId?: number
  preferredProvider?: SummaryProvider
}

export interface IncrementalAnalysisResult {
  summaries: NewsletterSummary[]
  digest: PersistedCombinedDigest
  cacheStats: { hits: number; misses: number }
  newlySummarized: number
  providerUsed: SummaryProvider | 'none'
}

export function createEmptyDigest(totalNewsletters: number = 0): PersistedCombinedDigest {
  return {
    generatedAt: new Date().toISOString(),
    totalNewsletters,
    themes: [],
    highlights: [],
    actionItems: [],
  }
}

export function resolvePreferredProvider(): SummaryProvider {
  const explicit = process.env.SUMMARIZER_PROVIDER
  if (explicit === 'openai' || explicit === 'ollama') return explicit
  if (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY) return 'openai'
  return 'ollama'
}

function resolveProviderModel(provider: SummaryProvider): string | null {
  if (provider === 'openai') {
    return process.env.SUMMARIZER_MODEL || 'gpt-5-mini'
  }

  return process.env.OLLAMA_MODEL || null
}

async function summarizeWithProvider(
  provider: SummaryProvider,
  newsletters: CanonicalNewsletter[],
  userId: string,
  senderOverrides: Record<string, string>
): Promise<NewsletterSummary[]> {
  if (provider === 'openai') {
    const result = await openaiSummarize(newsletters)
    const summaries = result.summaries as NewsletterSummary[]

    await Promise.all(
      summaries.map(async (summary) => {
        await cacheSummary(summary, userId)
        await upsertSummaryEmbedding(summary, userId)
      })
    )

    return summaries
  }

  const result = await ollamaSummarize(newsletters, userId, senderOverrides)
  return result.summaries
}

async function generateDigestWithProvider(
  provider: SummaryProvider,
  summaries: NewsletterSummary[]
): Promise<PersistedCombinedDigest> {
  if (provider === 'openai') {
    return (await openaiGenerateCombinedDigest(
      summaries as OpenaiNewsletterSummary[]
    )) as PersistedCombinedDigest
  }

  return (await ollamaGenerateCombinedDigest(summaries)) as PersistedCombinedDigest
}

export async function analyzeNewslettersIncremental(
  input: IncrementalAnalysisInput
): Promise<IncrementalAnalysisResult> {
  const senderOverrides = input.senderOverrides || {}
  const preferredProvider = input.preferredProvider || resolvePreferredProvider()

  const cachedById = new Map<string, NewsletterSummary>()
  await Promise.all(
    input.newsletters.map(async (newsletter) => {
      const cached = await getCachedSummary(newsletter.id, input.userId)
      if (cached) {
        cachedById.set(newsletter.id, cached)
      }
    })
  )

  const unsummarized = input.newsletters.filter((newsletter) => !cachedById.has(newsletter.id))

  if (unsummarized.length === 0) {
    const summaries = input.newsletters
      .map((newsletter) => cachedById.get(newsletter.id))
      .filter((summary): summary is NewsletterSummary => Boolean(summary))

    const latestSnapshot = await getLatestDigestSnapshot(input.userId, input.daysBack)
    return {
      summaries,
      digest: latestSnapshot?.digest || createEmptyDigest(summaries.length),
      cacheStats: { hits: summaries.length, misses: 0 },
      newlySummarized: 0,
      providerUsed: 'none',
    }
  }

  const providersToTry: SummaryProvider[] =
    preferredProvider === 'openai' ? ['openai', 'ollama'] : ['ollama']

  let providerUsed: SummaryProvider | null = null
  let newSummaries: NewsletterSummary[] = []
  let lastError: unknown = null

  for (const provider of providersToTry) {
    try {
      newSummaries = await summarizeWithProvider(provider, unsummarized, input.userId, senderOverrides)
      providerUsed = provider
      break
    } catch (error) {
      lastError = error
      console.error(`Failed summarization with ${provider}:`, error)
    }
  }

  if (!providerUsed) {
    throw lastError instanceof Error ? lastError : new Error('No summarizer provider succeeded')
  }

  const newSummaryById = new Map(newSummaries.map((summary) => [summary.id, summary]))
  const allSummaries = input.newsletters
    .map((newsletter) => newSummaryById.get(newsletter.id) || cachedById.get(newsletter.id))
    .filter((summary): summary is NewsletterSummary => Boolean(summary))

  let digest: PersistedCombinedDigest
  try {
    digest = await generateDigestWithProvider(providerUsed, allSummaries)
    await saveDigestSnapshot({
      userId: input.userId,
      daysBack: input.daysBack,
      provider: providerUsed,
      model: resolveProviderModel(providerUsed),
      digest,
      sourceRunId: input.sourceRunId,
    })
  } catch (error) {
    console.error('Failed to generate updated digest snapshot:', error)
    const latestSnapshot = await getLatestDigestSnapshot(input.userId, input.daysBack)
    digest = latestSnapshot?.digest || createEmptyDigest(allSummaries.length)
  }

  return {
    summaries: allSummaries,
    digest,
    cacheStats: {
      hits: allSummaries.length - newSummaries.length,
      misses: newSummaries.length,
    },
    newlySummarized: newSummaries.length,
    providerUsed,
  }
}
