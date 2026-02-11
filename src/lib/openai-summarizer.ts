import OpenAI from 'openai'
import { EmailMessage, extractTextFromHtml } from './microsoft-graph'

// Lazy-load OpenAI client to avoid build-time initialization
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
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

export async function summarizeNewsletter(email: EmailMessage): Promise<NewsletterSummary> {
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
      model: 'gpt-4o-mini',
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
      temperature: 0.3,
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
      model: 'gpt-4o-mini',
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
      temperature: 0.4,
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
  emails: EmailMessage[]
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

