# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Single Next.js 14 application — AI-powered newsletter digest using RSS feeds. SQLite for local dev, PostgreSQL for production. Hosted model APIs are the default summarization path; local Ollama is legacy/optional. See `README.md` for architecture and API docs.

### Running services

- **Next.js dev server**: `npm run dev` (port 3000)
- **Model provider**: default is hosted API (`gpt-5-mini` target). Ollama may be used as optional fallback only.

### Key commands

Per `package.json` scripts — `npm run lint`, `npm run test`, `npm run build`, `npm run smoke:e2e`, `npm run dev`.

### Gotchas

- The `.nvmrc` file is present but empty; Node.js 18+ is required (any recent version works).
- SQLite is used by default when `DATABASE_URL` is not set. Set `DB_PROVIDER=sqlite` in `.env.local` to be explicit.
- The SQLite compatibility layer in `persistent-db.ts` converts Postgres-style SQL to SQLite automatically (parameter binding, type casts, boolean literals, INTERVAL syntax). If adding new queries, write them in Postgres style and the converter handles the rest.
- If using Ollama fallback, it must be installed separately (`curl -fsSL https://ollama.com/install.sh | sh`) and requires `zstd` (`sudo apt-get install -y zstd`).
- Tests use Node.js built-in test runner (`node --test --experimental-strip-types`); no external test framework needed.

### Product direction guardrails (must follow)

- RSS-first is mandatory for current scope; do not re-introduce Microsoft Graph/mailbox-permissions-based ingestion.
- Remove Microsoft-centric Azure AD auth UX from active product flow; target invite-only email account auth for beta.
- Invite-only beta uses a shared invite code (`INVITE_CODE`) for account creation.
- Persist newsletters and summaries per user for long-horizon analytics; retention is effectively multi-year.
- Store newsletter content with a high size cap (guardrails for abusive/unreasonably large payloads only).
- Default model direction is `gpt-5-mini`, with OpenRouter compatibility required.
- Add and maintain both themes, with light mode as default.
- Non-RSS ingestion adapters are explicitly deferred to a later phase.

### Prompt engineering standards

- Use explicit system prompts with a clear persona and task boundaries.
- Prefer structured outputs with strict JSON schema expectations.
- Keep prompts versioned (e.g. prompt IDs/version fields) so outputs are auditable over time.
- Record model/provider metadata with generated summaries for analytics and debugging.
- Avoid hidden prompt mutations inside business logic; centralize prompt templates where practical.

### Coding agent workflow and definition of done

- Every non-trivial change must include targeted verification (`npm run lint`, relevant tests, and build when applicable).
- If a change affects user flows, include or update a high-signal smoke test (`npm run smoke:e2e` once present).
- For UI changes, provide visual walkthrough artifacts.
- Keep migration notes for schema changes and confirm SQLite + Postgres compatibility.
- Do not ship behavior-changing prompt/provider changes without updating docs and env config notes.

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
