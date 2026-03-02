import OpenAI from 'openai'
import { extractTextFromHtml } from './html-to-text'
import { CanonicalNewsletter } from './newsletter-model'

// Lazy-load OpenAI client to avoid build-time initialization
function getOpenAIClient(): OpenAI {
  const forceOpenRouter = process.env.SUMMARIZER_OPENROUTER === 'true'
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY)
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY)
  const useOpenRouter = forceOpenRouter || (hasOpenRouterKey && !hasOpenAiKey)
  const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('No API key configured for summarization provider')
  }

  return new OpenAI({
    apiKey,
    baseURL: useOpenRouter
      ? process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
      : process.env.OPENAI_BASE_URL,
    defaultHeaders: useOpenRouter
      ? {
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://newsletter-digest.local',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'Newsletter Digest',
        }
      : undefined,
  })
}

function resolveSummaryModel(): string {
  return process.env.SUMMARIZER_MODEL || 'gpt-5-mini'
}

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
  readTime: number // estimated reading time in minutes
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

export async function summarizeNewsletter(email: CanonicalNewsletter): Promise<NewsletterSummary> {
  const textContent = email.body.contentType === 'html' 
    ? extractTextFromHtml(email.body.content)
    : email.body.content

  // Limit content to avoid token limits
  const truncatedContent = textContent.slice(0, 8000)

  const prompt = `Analyze this newsletter and provide a structured summary.

Newsletter Subject: ${email.subject}
From: ${email.from.emailAddress.name} <${email.from.emailAddress.address}>

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
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: resolveSummaryModel(),
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing newsletters and extracting key insights. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    return {
      id: email.id,
      subject: email.subject,
      sender: email.from.emailAddress.name,
      senderEmail: email.from.emailAddress.address,
      receivedAt: email.receivedDateTime,
      summary: result.summary || 'Unable to generate summary',
      keyPoints: result.keyPoints || [],
      topics: result.topics || [],
      sentiment: result.sentiment || 'neutral',
      readTime: result.readTimeMinutes || 5,
    }
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
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: resolveSummaryModel(),
      messages: [
        {
          role: 'system',
          content: 'You are an expert at synthesizing information from multiple sources and identifying patterns. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

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
  emails: CanonicalNewsletter[]
): Promise<{ summaries: NewsletterSummary[]; digest: CombinedDigest }> {
  // Process newsletters in parallel (with a limit to avoid rate limits)
  const batchSize = 5
  const summaries: NewsletterSummary[] = []

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(summarizeNewsletter))
    summaries.push(...batchResults)
  }

  // Generate combined digest
  const digest = await generateCombinedDigest(summaries)

  return { summaries, digest }
}

