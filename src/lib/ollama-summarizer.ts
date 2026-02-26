import { extractTextFromHtml } from './microsoft-graph'
import { CanonicalNewsletter } from './newsletter-model'
import { getCachedSummary, cacheSummary } from './cache-db'
import { getNewsletterDisplayName } from './sender-parser'
import { startProgress, updateProgress, clearProgress } from './progress-tracker'
import { upsertSummaryEmbedding } from './semantic-search'

export interface NewsletterSummary {
  id: string
  subject: string
  sender: string
  senderEmail: string
  receivedAt: string
  summary: string
  keyPoints: string[]
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  readTime: number
}

export interface CombinedDigest {
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

// Ollama API client with timeout
async function callOllama(prompt: string, systemPrompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL || 'llama3.2'
  const timeoutMs = 180000 // 3 minutes timeout

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama request timed out after 3 minutes')
    }
    throw error
  }
}

export async function summarizeNewsletter(
  email: CanonicalNewsletter,
  userEmail: string,
  senderOverrides: Record<string, string> = {}
): Promise<NewsletterSummary> {
  // Check cache first
  const cached = await getCachedSummary(email.id, userEmail)
  if (cached) {
    console.log(`✅ Cache hit for email: ${email.subject}`)
    return cached
  }

  console.log(`🔄 Generating summary for: ${email.subject}`)
  
  // Extract the real sender (handles forwarded emails)
  const displaySender = getNewsletterDisplayName(email, senderOverrides)
  
  const textContent = email.body.contentType === 'html' 
    ? extractTextFromHtml(email.body.content)
    : email.body.content

  // Limit content to avoid context limits
  const truncatedContent = textContent.slice(0, 8000)

  const systemPrompt = 'You are an expert at analyzing newsletters and extracting key insights. Always respond with valid JSON.'
  
  const prompt = `Analyze this newsletter and provide a structured summary.

Newsletter Subject: ${email.subject}
From: ${displaySender.name} <${displaySender.address}>

Content:
${truncatedContent}

Respond in JSON format with the following structure:
{
  "summary": "A concise 2-3 sentence summary of the newsletter's main content",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive" | "neutral" | "negative",
  "readTimeMinutes": estimated_reading_time_as_number
}

Focus on extracting actionable insights and the most important information. Keep key points concise but informative.`

  try {
    const responseText = await callOllama(prompt, systemPrompt)
    const result = JSON.parse(responseText)

    const summary: NewsletterSummary = {
      id: email.id,
      subject: email.subject,
      sender: displaySender.name,
      senderEmail: displaySender.address,
      receivedAt: email.receivedDateTime,
      summary: result.summary || 'Unable to generate summary',
      keyPoints: result.keyPoints || [],
      topics: result.topics || [],
      sentiment: result.sentiment || 'neutral',
      readTime: result.readTimeMinutes || 5,
    }

    // Cache the summary
    await cacheSummary(summary, userEmail)
    await upsertSummaryEmbedding(summary, userEmail)
    console.log(`💾 Cached summary for: ${email.subject}`)

    return summary
  } catch (error) {
    console.error('Error summarizing newsletter:', error)
    throw error
  }
}

export async function generateCombinedDigest(
  summaries: NewsletterSummary[]
): Promise<CombinedDigest> {
  if (summaries.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      totalNewsletters: 0,
      themes: [],
      highlights: [],
      actionItems: [],
    }
  }

  const summariesText = summaries
    .map(
      (s) =>
        `Newsletter: ${s.subject}\nFrom: ${s.sender}\nSummary: ${s.summary}\nKey Points: ${s.keyPoints.join('; ')}\nTopics: ${s.topics.join(', ')}`
    )
    .join('\n\n---\n\n')

  const systemPrompt = 'You are an expert at synthesizing information from multiple sources and identifying patterns. Always respond with valid JSON.'
  
  const prompt = `Analyze these newsletter summaries and create a combined digest that identifies themes across all newsletters.

${summariesText}

Respond in JSON format with the following structure:
{
  "themes": [
    {
      "theme": "Theme name",
      "description": "Description of how this theme appears across newsletters",
      "relatedNewsletters": ["Newsletter subject 1", "Newsletter subject 2"]
    }
  ],
  "highlights": ["Most important highlight 1", "Most important highlight 2", "Most important highlight 3"],
  "actionItems": ["Action item or recommendation 1", "Action item or recommendation 2"]
}

Identify 2-4 major themes that appear across multiple newsletters. Extract the top 3-5 most important highlights and any actionable recommendations.`

  try {
    const responseText = await callOllama(prompt, systemPrompt)
    const result = JSON.parse(responseText)

    return {
      generatedAt: new Date().toISOString(),
      totalNewsletters: summaries.length,
      themes: result.themes || [],
      highlights: result.highlights || [],
      actionItems: result.actionItems || [],
    }
  } catch (error) {
    console.error('Error generating combined digest:', error)
    throw error
  }
}

export async function summarizeNewsletters(
  emails: CanonicalNewsletter[],
  userEmail: string,
  senderOverrides: Record<string, string> = {}
): Promise<{ summaries: NewsletterSummary[]; digest: CombinedDigest; cacheStats: { hits: number; misses: number } }> {
  // Initialize progress tracking
  startProgress(userEmail, emails.length)
  
  // Process newsletters with controlled concurrency (2-3 at a time)
  const summaries: NewsletterSummary[] = []
  let cacheHits = 0
  let cacheMisses = 0
  // Read concurrency from env, default to 2 (safe for most systems)
  // Increase to 3-4 if you have a powerful CPU/GPU
  const concurrency = parseInt(process.env.OLLAMA_CONCURRENCY || '2')

  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency)
    
    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (email, batchIndex) => {
        const globalIndex = i + batchIndex
        const displaySender = getNewsletterDisplayName(email, senderOverrides)
        
        // Update progress
        updateProgress(userEmail, globalIndex, email.subject)
        
        const cached = await getCachedSummary(email.id, userEmail)
        if (cached) {
          return { summary: cached, fromCache: true }
        } else {
          const summary = await summarizeNewsletter(email, userEmail, senderOverrides)
          return { summary, fromCache: false }
        }
      })
    )

    // Collect results
    for (const result of batchResults) {
      summaries.push(result.summary)
      await upsertSummaryEmbedding(result.summary, userEmail)
      if (result.fromCache) {
        cacheHits++
      } else {
        cacheMisses++
      }
    }
  }

  // Update progress to completed
  updateProgress(userEmail, emails.length, 'Generating combined insights...')

  console.log(`📊 Cache stats - Hits: ${cacheHits}, Misses: ${cacheMisses}, Hit rate: ${cacheHits > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1) : 0}%`)

  // Generate combined digest
  const digest = await generateCombinedDigest(summaries)

  // Clear progress
  clearProgress(userEmail)

  return { summaries, digest, cacheStats: { hits: cacheHits, misses: cacheMisses } }
}
