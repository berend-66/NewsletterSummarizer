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

Create `.env.local` (or copy from `.env.example`):

```env
# Optional: comma-separated RSS feed URLs
RSS_FEEDS=https://example.com/feed.xml,https://another.com/rss

# Ollama config
OLLAMA_URL=[REDACTED]
OLLAMA_MODEL=[REDACTED]
OLLAMA_CONCURRENCY=2

# Optional: lock down cron endpoint
CRON_SECRET=your-random-secret

# Local default (optional): force SQLite
DB_PROVIDER=sqlite
SQLITE_DB_PATH=./newsletter.db

# Production/Postgres mode (Railway managed Postgres)
# If DATABASE_URL is set, provider defaults to postgres.
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

### Production service topology

Use three Railway services:

1. **`web`** (this repository root) — Next.js app
2. **`postgres`** — Railway managed PostgreSQL
3. **`digest-cron`** (`ops/railway/digest-cron`) — scheduled caller for `/api/cron/digest`

The repository includes:

- Root `railway.json` for the web service (build/start + healthcheck)
- `ops/railway/digest-cron/railway.json` for the cron worker (`cronSchedule`)
- `scripts/railway/provision-production.sh` for repeatable provisioning/deploy

### One-command provisioning (CLI)

After linking this directory to your Railway project:

```bash
npm run railway:provision
```

Prerequisites: valid Railway auth (`RAILWAY_API_TOKEN` set or `npx -y @railway/cli login`).

This script will:

- create `postgres`, `web`, and `digest-cron` services (if missing)
- wire `DATABASE_URL` from Postgres into `web`
- generate/set `CRON_SECRET` on `web` and propagate it to `digest-cron`
- deploy `web` from repo root and `digest-cron` from `ops/railway/digest-cron`

### Required production variables (`web` service)

- `NODE_ENV=production`
- `DB_PROVIDER=postgres`
- `DATABASE_URL=${{postgres.DATABASE_URL}}`
- `CRON_SECRET=<long-random-secret>`
- `OLLAMA_URL=<reachable Ollama endpoint>`
- `OLLAMA_MODEL=<model-name>`

Optional:

- `RSS_FEEDS` (fallback feeds when user settings are empty)
- `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL` (semantic search embeddings)

### Health checks

- Railway health path: `/api/health`
- Endpoint validates DB connectivity and returns `503` if DB is unavailable.

### Scheduler cadence

`digest-cron` defaults to `0 */4 * * *` (every 4 hours). Adjust `cronSchedule` in `ops/railway/digest-cron/railway.json` if needed.

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
- On SQLite (local), semantic search falls back to exact same embeddings with JS cosine ranking (no ANN index).

## License

MIT
