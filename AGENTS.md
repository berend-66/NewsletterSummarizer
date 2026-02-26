# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Single Next.js 14 application — AI-powered newsletter digest using RSS feeds + Ollama LLM summarization. SQLite for local dev, PostgreSQL for production. See `README.md` for full architecture and API docs.

### Running services

- **Next.js dev server**: `npm run dev` (port 3000)
- **Ollama**: must be running (`ollama serve`) before triggering summarization. Configure `OLLAMA_URL` and `OLLAMA_MODEL` in `.env.local` (see `README.md` for defaults and example values).

### Key commands

Per `package.json` scripts — `npm run lint`, `npm run test`, `npm run build`, `npm run dev`.

### Gotchas

- The `.nvmrc` file is present but empty; Node.js 18+ is required (any recent version works).
- SQLite is used by default when `DATABASE_URL` is not set. Set `DB_PROVIDER=sqlite` in `.env.local` to be explicit.
- The SQLite compatibility layer in `persistent-db.ts` converts Postgres-style SQL to SQLite automatically (parameter binding, type casts, boolean literals, INTERVAL syntax). If adding new queries, write them in Postgres style and the converter handles the rest.
- Ollama must be installed separately (`curl -fsSL https://ollama.com/install.sh | sh`) and requires `zstd` (`sudo apt-get install -y zstd`). Pull a model before use (e.g. a small 1b variant for CPU environments).
- Tests use Node.js built-in test runner (`node --test --experimental-strip-types`); no external test framework needed.

### Railway MCP

The Railway MCP server is configured in `.cursor/mcp.json`. It requires `RAILWAY_API_TOKEN` to be set as a secret. The MCP provides tools for project/service management, deployments, environment variables, logs, and domain generation on Railway. The MCP server uses stdio transport and is started automatically by Cursor — no manual launch needed.

### Railway production deployment

- **Project**: `newsletter-summarizer` on Railway
- **Services**: PostgreSQL (managed) + `newsletter-app` (Next.js)
- **URL**: `newsletter-app-production.up.railway.app`
- **Database**: PostgreSQL via private networking (`DATABASE_URL` references `Postgres.DATABASE_URL`)
- **Builder**: Railway's default Nixpacks builder (reads `railway.json` for deploy config)
- The app gracefully falls back to TEXT columns if pgvector extension is unavailable
- Summarization requires Ollama or an alternative LLM endpoint — not included on Railway by default. Without it, RSS feed ingestion and settings work, but AI summaries fail with `ECONNREFUSED`
