export interface CanonicalNewsletter {
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
    contentType: 'text' | 'html'
  }
  isRead: boolean
  source: {
    type: 'rss'
    feedUrl: string
    feedTitle?: string
    itemGuid?: string
    itemLink?: string
    dedupeKey: string
  }
}
