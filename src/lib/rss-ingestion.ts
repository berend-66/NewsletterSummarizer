import { createHash } from 'crypto'
import type { CanonicalNewsletter } from './newsletter-model'

interface RssIngestionOptions {
  daysBack?: number
  maxItemsPerFeed?: number
  feedFilters?: string[]
}

export interface FeedFetchMetric {
  feedUrl: string
  checkedAt: string
  success: boolean
  durationMs: number
  itemCount: number
  statusCode?: number
  error?: string
}

export interface RssIngestionResult {
  newsletters: CanonicalNewsletter[]
  metrics: FeedFetchMetric[]
}

interface FeedItemContext {
  feedUrl: string
  feedTitle: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n+/g, '\n')
    .trim()
}

function normalizeLink(linkValue: unknown): string | undefined {
  if (!linkValue) return undefined
  if (typeof linkValue === 'string') return linkValue

  return undefined
}

function parsePublishedAt(rawDate: string | undefined): string {
  if (!rawDate) return new Date().toISOString()
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.valueOf())) return new Date().toISOString()
  return parsed.toISOString()
}

function buildDedupeKey(guid: string, link: string, subject: string, content: string): string {
  const input = `${guid}|${link}|${subject}|${content.slice(0, 1000)}`
  return createHash('sha256').update(input).digest('hex')
}

function decodeCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

function extractTagValue(input: string, tagNames: string[]): string {
  for (const tagName of tagNames) {
    const escapedTag = tagName.replace(':', '\\:')
    const tagPattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTag}>`, 'i')
    const selfClosingPattern = new RegExp(`<${escapedTag}[^>]*?\\/?>`, 'i')
    const tagMatch = input.match(tagPattern)
    if (tagMatch?.[1]) {
      return decodeCdata(tagMatch[1].trim())
    }
    if (selfClosingPattern.test(input) && tagName === 'link') {
      const hrefMatch = input.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)
      if (hrefMatch?.[1]) {
        return hrefMatch[1]
      }
    }
  }
  return ''
}

function extractBlocks(input: string, tagName: string): string[] {
  const escapedTag = tagName.replace(':', '\\:')
  const pattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTag}>`, 'gi')
  const blocks: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input)) !== null) {
    blocks.push(match[1])
  }

  return blocks
}

function itemToCanonicalNewsletter(itemXml: string, context: FeedItemContext): CanonicalNewsletter | null {
  const title = extractTagValue(itemXml, ['title']).trim()
  const link = normalizeLink(extractTagValue(itemXml, ['link'])) || ''
  const guid = extractTagValue(itemXml, ['guid', 'id']).trim() || link
  const published = parsePublishedAt(
    extractTagValue(itemXml, ['pubDate', 'published', 'updated', 'dc:date'])
  )

  const rawDescription = extractTagValue(itemXml, [
    'content:encoded',
    'content',
    'description',
    'summary',
    'subtitle',
  ])

  if (!title && !rawDescription) {
    return null
  }

  const author =
    extractTagValue(itemXml, ['author', 'dc:creator']) || context.feedTitle || 'RSS Feed'

  const contentType: 'text' | 'html' = rawDescription.includes('<') ? 'html' : 'text'
  const previewText = contentType === 'html' ? stripHtml(rawDescription) : rawDescription
  const bodyPreview = previewText.slice(0, 240)

  const dedupeKey = buildDedupeKey(guid, link, title, previewText)

  return {
    id: dedupeKey,
    subject: title || `Update from ${context.feedTitle || 'RSS Feed'}`,
    from: {
      emailAddress: {
        name: author || context.feedTitle || 'RSS Feed',
        address: context.feedUrl,
      },
    },
    receivedDateTime: published,
    bodyPreview,
    body: {
      content: rawDescription || previewText,
      contentType,
    },
    isRead: false,
    source: {
      type: 'rss',
      feedUrl: context.feedUrl,
      feedTitle: context.feedTitle,
      itemGuid: guid || undefined,
      itemLink: link || undefined,
      dedupeKey,
    },
  }
}

export function parseFeedXml(feedXml: string, feedUrl: string): CanonicalNewsletter[] {
  const isRss = /<rss[\s>]/i.test(feedXml)
  const isAtom = /<feed[\s>]/i.test(feedXml)

  if (!isRss && !isAtom) {
    throw new Error('Unsupported feed format (expected RSS or Atom)')
  }

  const channelBlock = extractTagValue(feedXml, ['channel'])
  const feedTitle = extractTagValue(channelBlock || feedXml, ['title']) || feedUrl
  const items = isRss ? extractBlocks(feedXml, 'item') : extractBlocks(feedXml, 'entry')

  return items
    .map((item) => itemToCanonicalNewsletter(item, { feedUrl, feedTitle }))
    .filter((item): item is CanonicalNewsletter => item !== null)
}

async function fetchFeed(
  feedUrl: string
): Promise<{ items: CanonicalNewsletter[]; metric: FeedFetchMetric }> {
  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'NewsletterSummarizer/1.0 RSS Fetcher',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const durationMs = Date.now() - startedAt
      return {
        items: [],
        metric: {
          feedUrl,
          checkedAt,
          success: false,
          durationMs,
          itemCount: 0,
          statusCode: response.status,
          error: `Failed to fetch feed (${response.status})`,
        },
      }
    }

    const feedXml = await response.text()
    const items = parseFeedXml(feedXml, feedUrl)
    const durationMs = Date.now() - startedAt

    return {
      items,
      metric: {
        feedUrl,
        checkedAt,
        success: true,
        durationMs,
        itemCount: items.length,
        statusCode: response.status,
      },
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    console.error(`Error fetching RSS feed ${feedUrl}:`, error)
    return {
      items: [],
      metric: {
        feedUrl,
        checkedAt,
        success: false,
        durationMs,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown feed fetch error',
      },
    }
  }
}

export function dedupeNewsletters(items: CanonicalNewsletter[]): CanonicalNewsletter[] {
  const seen = new Set<string>()
  const deduped: CanonicalNewsletter[] = []

  for (const item of items) {
    const dedupeKey = item.source.dedupeKey
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    deduped.push(item)
  }

  return deduped
}

export async function getNewslettersFromRss(
  feedUrls: string[],
  options: RssIngestionOptions = {}
): Promise<RssIngestionResult> {
  const { daysBack = 7, maxItemsPerFeed = 50, feedFilters = [] } = options
  const normalizedFeedFilters = feedFilters.map((filter) => filter.toLowerCase())
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)

  const settled = await Promise.allSettled(feedUrls.map((feedUrl) => fetchFeed(feedUrl)))
  const metrics = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value.metric] : []
  )
  const allItems = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.items.slice(0, maxItemsPerFeed) : []
  )

  const filteredByDate = allItems.filter(
    (item) => new Date(item.receivedDateTime).valueOf() >= cutoff.valueOf()
  )

  const filteredByFeed =
    normalizedFeedFilters.length > 0
      ? filteredByDate.filter((item) => {
          const source = `${item.from.emailAddress.name} ${item.from.emailAddress.address}`.toLowerCase()
          return normalizedFeedFilters.some((filter) => source.includes(filter))
        })
      : filteredByDate

  const newsletters = dedupeNewsletters(filteredByFeed).sort(
    (a, b) => new Date(b.receivedDateTime).valueOf() - new Date(a.receivedDateTime).valueOf()
  )

  return {
    newsletters,
    metrics,
  }
}
