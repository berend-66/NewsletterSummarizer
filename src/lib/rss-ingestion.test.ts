import test from 'node:test'
import assert from 'node:assert/strict'
import { dedupeNewsletters, parseFeedXml } from './rss-ingestion.ts'
import { getNewsletterDisplayName } from './sender-parser.ts'

test('parses RSS feed and normalizes fields', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Example Feed</title>
      <item>
        <title>Newsletter Item One</title>
        <link>https://example.com/item-1</link>
        <guid>item-1-guid</guid>
        <pubDate>Mon, 22 Jan 2024 10:00:00 GMT</pubDate>
        <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
      </item>
    </channel>
  </rss>`

  const parsed = parseFeedXml(rssXml, 'https://example.com/feed.xml')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].subject, 'Newsletter Item One')
  assert.equal(parsed[0].from.emailAddress.name, 'Example Feed')
  assert.equal(parsed[0].source.feedUrl, 'https://example.com/feed.xml')
  assert.equal(parsed[0].source.itemGuid, 'item-1-guid')
  assert.equal(parsed[0].body.contentType, 'html')
})

test('parses Atom feed and picks entry link href', () => {
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>Atom Feed</title>
    <entry>
      <id>tag:example.com,2026:item-2</id>
      <title>Atom Item Two</title>
      <updated>2026-02-20T07:00:00Z</updated>
      <link href="https://example.com/atom-2" />
      <summary>Summary text</summary>
    </entry>
  </feed>`

  const parsed = parseFeedXml(atomXml, 'https://example.com/atom.xml')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].subject, 'Atom Item Two')
  assert.equal(parsed[0].source.itemLink, 'https://example.com/atom-2')
  assert.equal(parsed[0].source.itemGuid, 'tag:example.com,2026:item-2')
})

test('dedupes identical normalized newsletters', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Feed A</title>
      <item>
        <title>Same Item</title>
        <link>https://example.com/same-item</link>
        <guid>shared-guid</guid>
        <pubDate>Mon, 22 Jan 2024 10:00:00 GMT</pubDate>
        <description>Body</description>
      </item>
    </channel>
  </rss>`

  const first = parseFeedXml(rssXml, 'https://example.com/feed-a.xml')
  const second = parseFeedXml(rssXml, 'https://example.com/feed-b.xml')
  const deduped = dedupeNewsletters([...first, ...second])

  assert.equal(deduped.length, 1)
})

test('normalized newsletter remains compatible with sender display pipeline', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Morning Brew</title>
      <item>
        <title>Daily digest</title>
        <link>https://example.com/daily</link>
        <guid>digest-1</guid>
        <pubDate>Mon, 22 Jan 2024 10:00:00 GMT</pubDate>
        <description>Digest body</description>
      </item>
    </channel>
  </rss>`

  const [newsletter] = parseFeedXml(rssXml, 'https://example.com/morningbrew.xml')
  const displaySender = getNewsletterDisplayName(newsletter, {
    'https://example.com/morningbrew.xml': 'Morning Brew Override',
  })

  assert.equal(displaySender.name, 'Morning Brew Override')
})
