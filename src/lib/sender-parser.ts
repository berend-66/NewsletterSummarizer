import { EmailMessage } from './microsoft-graph'

/**
 * Extract the original sender from a forwarded email
 */
export function extractOriginalSender(email: EmailMessage): {
  name: string
  address: string
} {
  const bodyContent = email.body.content
  const isForwarded = 
    email.subject.toLowerCase().includes('fwd:') ||
    email.subject.toLowerCase().includes('fw:') ||
    bodyContent.includes('Forwarded message') ||
    bodyContent.includes('---------- Forwarded') ||
    bodyContent.includes('Begin forwarded message')

  if (!isForwarded) {
    // Not forwarded, use the actual sender
    return {
      name: email.from.emailAddress.name,
      address: email.from.emailAddress.address,
    }
  }

  // Try to extract original sender from forwarded message
  const originalSender = parseForwardedSender(bodyContent)
  
  if (originalSender) {
    return originalSender
  }

  // Fallback: use the current sender
  return {
    name: email.from.emailAddress.name,
    address: email.from.emailAddress.address,
  }
}

/**
 * Parse forwarded email body to extract original sender
 */
function parseForwardedSender(body: string): { name: string; address: string } | null {
  // Common forwarded message patterns
  const patterns = [
    // Pattern 1: "From: Name <email@domain.com>"
    /From:\s*([^<]+?)\s*<([^>]+)>/i,
    // Pattern 2: "From: email@domain.com"
    /From:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // Pattern 3: HTML format "From:</strong> Name &lt;email@domain.com&gt;"
    /From:<\/?\w+>\s*([^&<]+?)\s*&lt;([^&>]+)&gt;/i,
  ]

  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match) {
      if (match.length === 3) {
        // Has both name and email
        return {
          name: match[1].trim(),
          address: match[2].trim(),
        }
      } else if (match.length === 2) {
        // Only email
        const email = match[1].trim()
        const name = extractNameFromEmail(email)
        return {
          name: name,
          address: email,
        }
      }
    }
  }

  return null
}

/**
 * Extract a display name from an email address
 * e.g., "newsletter@morningbrew.com" → "Morning Brew"
 */
function extractNameFromEmail(email: string): string {
  const [localPart, domain] = email.split('@')
  
  if (!domain) return email
  
  // Common newsletter patterns
  if (localPart === 'newsletter' || localPart === 'hello' || localPart === 'team') {
    // Use domain name
    const domainName = domain.split('.')[0]
    return capitalizeWords(domainName)
  }
  
  // Use local part
  return capitalizeWords(localPart.replace(/[._-]/g, ' '))
}

/**
 * Capitalize words in a string
 */
function capitalizeWords(str: string): string {
  return str
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get sender override from settings
 */
export function getSenderOverride(senderEmail: string, overrides: Record<string, string>): string | null {
  // Check exact email match
  if (overrides[senderEmail.toLowerCase()]) {
    return overrides[senderEmail.toLowerCase()]
  }
  
  // Check domain match
  const domain = senderEmail.split('@')[1]
  if (domain && overrides[domain.toLowerCase()]) {
    return overrides[domain.toLowerCase()]
  }
  
  return null
}

/**
 * Get the best display name for a newsletter sender
 */
export function getNewsletterDisplayName(
  email: EmailMessage,
  senderOverrides: Record<string, string> = {}
): { name: string; address: string } {
  // First, extract the original sender from forwarded email
  const originalSender = extractOriginalSender(email)
  
  // Check if there's a manual override
  const override = getSenderOverride(originalSender.address, senderOverrides)
  
  if (override) {
    return {
      name: override,
      address: originalSender.address,
    }
  }
  
  return originalSender
}
