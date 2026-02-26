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
- The `updateUserSettings` code path has a known SQLite boolean-binding issue (`SQLite3 can only bind numbers, strings, bigints, buffers, and null`) — the `autoDetect` boolean value is passed directly to `better-sqlite3` which rejects booleans. This causes 500 errors on the PUT `/api/settings` endpoint. The "Demo Data" button on the dashboard works as an alternative to verify UI functionality.
- Ollama must be installed separately (`curl -fsSL https://ollama.com/install.sh | sh`) and requires `zstd` (`sudo apt-get install -y zstd`). Pull a model before use (e.g. a small 1b variant for CPU environments).
- Tests use Node.js built-in test runner (`node --test --experimental-strip-types`); no external test framework needed.
