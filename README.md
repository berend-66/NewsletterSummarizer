# Newsletter Digest (RSS-first)

AI-powered newsletter summaries and cross-newsletter trend analysis using RSS/Atom feeds.

## Why RSS-first

The project now ingests newsletters directly from RSS feeds instead of email forwarding + Microsoft Graph. This removes mailbox forwarding complexity, avoids Graph permission setup, and improves ingestion reliability.

## Features

- RSS/Atom ingestion across multiple feeds
- Canonical newsletter normalization for downstream summarization
- Dedupe/idempotency via guid/link/content hash
- AI summaries for each item
- Cross-newsletter themes/highlights/action items
- Persistent user-owned feed configuration (PostgreSQL)
- Feed health metrics per user/feed
- Scheduler endpoint for automated digest runs

## Quick Start

### Prerequisites

- Node.js 18+
- Ollama running locally (or remote endpoint)

### 1) Install

```bash
npm install
```

### 2) Configure environment

Create `.env.local`:

```env
# Optional: comma-separated RSS feed URLs
RSS_FEEDS=https://example.com/feed.xml,https://another.com/rss

# Ollama config
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_CONCURRENCY=2

# Optional: lock down cron endpoint
CRON_SECRET=your-random-secret

# Required: Postgres connection (Railway managed Postgres)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Optional: semantic search embeddings
OPENAI_API_KEY=sk-...
OPENAI_EMBED_MODEL=text-embedding-3-small
```

If `RSS_FEEDS` is not set, you can configure feeds in the app Settings page.

### 3) Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Configuration

### Settings page

- **RSS Feeds**: feed URLs to ingest
- **Feed Filters**: optional source-name/domain filters
- **Sender Display Names**: source override mapping
- **Feed Health**: latest check status, failures, latency, item count
- **Digest schedule fields**: metadata for scheduler integration

### User ownership model

- Each user owns their own `rssFeeds`, filters, overrides, and feed health rows.
- User identity is resolved via `x-user-id` header (defaults to `local-user` in local mode).
- This allows multi-user isolation even without Microsoft Graph ingestion.

### API

- `GET /api/newsletters?days=7&summarize=true`
  - Fetches RSS items, normalizes, dedupes, summarizes, and updates feed health
- `GET /api/settings`, `PUT /api/settings`, `POST /api/settings`
  - Manage feed/filter configuration and return feed health
- `GET /api/progress`
  - Poll summarization progress
- `POST /api/cron/digest?days=7`
  - Runs scheduled ingestion/summarization for all users with configured feeds
  - Protect with `CRON_SECRET` via `x-cron-secret` or `Authorization: Bearer <secret>`
- `GET /api/search/semantic?q=...&limit=10`
  - Semantic similarity search across a user's summarized newsletter corpus

## Architecture (current)

```text
src/
├── app/
│   ├── api/
│   │   ├── cron/digest/          # Scheduler endpoint for periodic runs
│   │   ├── newsletters/          # RSS fetch + summarize endpoint
│   │   ├── progress/             # Progress polling
│   │   └── settings/             # User settings API
│   ├── settings/                 # Feed/filter configuration UI
│   └── page.tsx                  # Digest dashboard
└── lib/
    ├── persistent-db.ts          # Postgres schema + connection
    ├── rss-ingestion.ts          # RSS/Atom fetch + parse + normalize + dedupe
    ├── newsletter-model.ts       # Canonical newsletter model
    ├── ollama-summarizer.ts      # Individual and combined digest summaries
    ├── sender-parser.ts          # Source display normalization/overrides
    ├── cache-db.ts               # Summary cache (persistent)
    └── user-settings.ts          # Persistent settings/feed ownership/health
```

## Migration Notes (Email/Graph -> RSS)

### What changed

- Core ingestion path now uses RSS feeds.
- Microsoft Graph is no longer required for fetching newsletter content.
- Settings now support first-class `rssFeeds` entries.
- Existing summarization and trend logic continues to use the same canonical fields (`subject`, `from`, `body`, `receivedDateTime`).

### One-time migration actions

1. Remove Azure AD / Graph env vars from your runtime configuration if not needed.
2. Add feed URLs via `RSS_FEEDS` or Settings page.
3. Validate the first run with `days=7` and inspect the resulting digest.

## Railway Deployment Notes

### Persistent storage

- The app now uses PostgreSQL via `DATABASE_URL`.
- On Railway, provision a PostgreSQL service and expose `DATABASE_URL` to this app service.
- Current relational tables: `user_settings`, `user_feeds`, `user_feed_filters`, `user_sender_overrides`, `feed_health`, `summaries`.

### Scheduler setup on Railway

Use a Railway cron service/job to call:

```bash
curl -X POST "https://<your-app-domain>/api/cron/digest?days=7" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Recommended cadence: every 2-6 hours depending on feed freshness and model cost.

## Validation

Run:

```bash
npm run test
npm run lint
npm run build
```

## Troubleshooting

### No newsletters found

- Confirm at least one feed is configured (`RSS_FEEDS` or Settings page)
- Increase `days` query value
- Temporarily remove feed filters

### Some feed URLs fail

- Verify feed URL returns valid RSS/Atom XML
- Ensure source does not block generic user agents
- Check server logs for per-feed fetch errors
- Inspect feed health in Settings to identify repeated failures

### Duplicate entries

- Dedupe uses guid/link/content hash; if a publisher republishes with distinct metadata/content, entries may be treated as unique

## Known limitations

- Feed parsing is intentionally conservative to stay dependency-light
- Scheduler endpoint executes sequentially per user; high user volume may require queueing

## Vector Search Sketch

For this project, prefer **Postgres + pgvector first**:

- Keep metadata + ownership + scheduler state in Postgres.
- Add an `item_embeddings` table:
  - `user_id`, `newsletter_id`, `model`, `embedding vector(1536)`, `created_at`
- Query with ANN index (`ivfflat`/`hnsw`) for semantic retrieval.

Use a **dedicated vector DB** later only if:

- embedding corpus becomes very large,
- semantic query throughput dominates workload,
- you need vector-specific operational features beyond what Postgres provides.

Current implementation:

- `item_embeddings` table in Postgres with `VECTOR(1536)`
- embeddings generated from summary content at summarize time
- `/api/search/semantic` queries nearest neighbors with cosine distance

## License

MIT
