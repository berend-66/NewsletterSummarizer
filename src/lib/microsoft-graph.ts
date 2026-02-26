import { Client } from '@microsoft/microsoft-graph-client'

/**
 * @deprecated RSS ingestion is the primary path. This module is retained temporarily
 * for compatibility and can be removed once Graph auth and legacy flows are dropped.
 */
export interface EmailMessage {
  id: string
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  receivedDateTime: string
  bodyPreview: string
  body: {
    content: string
    contentType: string
  }
  isRead: boolean
}

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
}

export async function getEmails(
  accessToken: string,
  options: {
    senderFilters?: string[]
    daysBack?: number
    top?: number
  } = {}
): Promise<EmailMessage[]> {
  const { senderFilters = [], daysBack = 7, top = 50 } = options
  const client = createGraphClient(accessToken)

  // Build filter query
  const dateFilter = new Date()
  dateFilter.setDate(dateFilter.getDate() - daysBack)
  const dateString = dateFilter.toISOString()

  let filterQuery = `receivedDateTime ge ${dateString}`

  // Add sender filters if provided
  if (senderFilters.length > 0) {
    const senderConditions = senderFilters
      .map((sender) => `contains(from/emailAddress/address, '${sender}')`)
      .join(' or ')
    filterQuery += ` and (${senderConditions})`
  }

  try {
    const response = await client
      .api('/me/messages')
      .filter(filterQuery)
      .select('id,subject,from,receivedDateTime,bodyPreview,body,isRead')
      .top(top)
      .orderby('receivedDateTime desc')
      .get()

    return response.value as EmailMessage[]
  } catch (error) {
    console.error('Error fetching emails:', error)
    throw error
  }
}

export async function getUserProfile(accessToken: string) {
  const client = createGraphClient(accessToken)
  
  try {
    const user = await client.api('/me').select('displayName,mail,userPrincipalName').get()
    return user
  } catch (error) {
    console.error('Error fetching user profile:', error)
    throw error
  }
}

// Detect if an email is likely a newsletter
export function isLikelyNewsletter(email: EmailMessage): boolean {
  const body = email.body.content.toLowerCase()
  const subject = email.subject.toLowerCase()
  const senderName = email.from.emailAddress.name.toLowerCase()
  const senderAddress = email.from.emailAddress.address.toLowerCase()

  // Common newsletter indicators
  const newsletterIndicators = [
    'unsubscribe',
    'email preferences',
    'manage subscription',
    'view in browser',
    'view online',
    'newsletter',
    'weekly digest',
    'daily digest',
    'weekly roundup',
    'update your preferences',
  ]

  // Check for newsletter indicators in body
  const hasNewsletterIndicator = newsletterIndicators.some(
    (indicator) => body.includes(indicator)
  )

  // Common newsletter sender patterns
  const newsletterSenderPatterns = [
    'newsletter',
    'digest',
    'weekly',
    'noreply',
    'no-reply',
    'updates',
    'news@',
    'hello@',
    'team@',
  ]

  const hasNewsletterSender = newsletterSenderPatterns.some(
    (pattern) => senderAddress.includes(pattern) || senderName.includes(pattern)
  )

  return hasNewsletterIndicator || hasNewsletterSender
}

// Extract plain text from HTML
export function extractTextFromHtml(html: string): string {
  // Remove style and script tags
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ')
  text = text.replace(/\n\s+/g, '\n')
  text = text.replace(/\n+/g, '\n')
  
  return text.trim()
}

