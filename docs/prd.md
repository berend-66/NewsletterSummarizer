# Product Requirements Document (PRD)

## 1) Product overview

### Product name
Newsletter Digest Intelligence

### Problem statement
Professionals are overwhelmed by the volume of newsletters they receive. The product helps users ingest news faster by generating high-quality summaries and key points in a clear interface, so they can quickly decide which original newsletter to read in full. Over time, the same data powers trend analytics.

### Target users
Individual professionals.

### Current product state
The app is already close to a usable beta. Immediate focus is to make it reliably usable for day-to-day personal usage, then iterate from real testing feedback.

## 2) Product goals and success criteria

### Immediate goal (current phase)
Make the product personally usable in production-like daily use, then fix friction discovered during live testing.

### Secondary goal
Create a repo/process setup that enables coding agents to ship safely and quickly with minimal ambiguity.

### Success criteria
- User can authenticate without Azure AD / Microsoft Graph dependency.
- User can ingest configured RSS feeds and receive summaries.
- User can review summary + key points and choose whether to read full source.
- System stores newsletters and summaries per user for long-horizon analytics.
- Basic e2e smoke command passes in local/CI.

## 3) Scope decisions (confirmed)

### In scope now (P0/P1)
1. Remove Microsoft-centric auth UX and Azure AD dependency from product direction.
2. Implement account creation and login using email credentials (invite-only beta).
3. Keep RSS-first ingestion as primary source.
4. Store newsletter items and summaries durably per user.
5. Prepare analytics dimensions for topic/sector/geo/industry with a VC-relevant lens while preserving general utility.
6. Set yearly "Wrapped"-style analytics as target output.
7. Default summarization to `gpt-5-mini`.
8. Add OpenRouter-compatible client path.
9. Add light theme as default (cream/papyrus/parchment style), retain dark mode.
10. Address security baseline by upgrading vulnerable Next.js range to patched 14.x.
11. Add e2e smoke script.

### Deferred (Phase 2+)
1. Non-RSS ingestion adapters for newsletters that require subscription/email adapters.
2. Formal privacy/compliance posture (e.g., GDPR workflows), beyond basic good practices.

## 4) Functional requirements

### FR1 — Authentication and access
- Remove Azure AD dependence from normal product flows.
- Provide sign-up/login via email + password.
- Restrict beta to invite-only users.
- Keep local development mode practical for agents.

### FR2 — Durable data model
- Persist newsletter records with at least:
  - user linkage
  - sender/source
  - subject/title
  - content/body (large cap with abuse/safety guardrail)
  - timestamps and ingestion metadata
- Persist summaries and digest outputs with provider/model metadata.
- Retention target: multi-year (effectively "forever" for product intent).

### FR3 — Summarization providers
- Default provider/model: `gpt-5-mini`.
- Add OpenRouter routing compatibility for future centralized model operations.
- Keep provider abstraction; avoid hard-coding assumptions to one vendor.

### FR4 — Analytics foundation
- Track analytics-friendly fields for topic, sector, geography, industry, and other useful signals.
- Support VC-oriented views while remaining useful for general professionals.
- Define yearly wrapped output as milestone capability.

### FR5 — User interface and theming
- Add light mode theme (off-white/cream/papyrus/parchment-inspired).
- Set light mode as default.
- Keep dark mode available and legible.
- Preserve intuitive flow from summary -> key points -> source deep-dive decision.

### FR6 — Quality and reliability
- Add `npm run smoke:e2e` (or equivalent) for high-signal end-to-end checks.
- Keep existing lint/test/build checks green.
- Ensure robust logging for ingestion and summarization operations.

### FR7 — Security baseline
- Upgrade Next.js to patched 14.x and resolve audit-critical risk where feasible.
- Re-run lint/test/build/smoke after upgrade.

## 5) Non-functional requirements

- Reliability: ingestion and summarization failures are visible and recoverable.
- Performance: summarize typical daily volume with practical latency for regular use.
- Cost: model usage target around USD $50/month at current scale.
- Extensibility: architecture supports adding adapters and analytics dimensions later.
- Operability: logs and run metadata support debugging without relying on ad-hoc local state.

## 6) Milestones

### Milestone A — Foundation hardening
- Security upgrade (Next.js patched 14.x).
- Provider config defaults (`gpt-5-mini`, OpenRouter-ready settings).
- Remove Azure-centric auth UX from active flow.
- Add initial e2e smoke script.

### Milestone B — Usability-first beta
- Invite-only email/password auth.
- Light theme default + dark toggle.
- Durable newsletter + summary persistence reviewed for long-term retention.

### Milestone C — Insight expansion
- Analytics dimensions populated (topic/sector/geo/industry).
- First yearly wrapped prototype generation pipeline.

## 7) Agent execution backlog (starter)

### P0
1. Remove Azure auth UX and legacy Azure dependency from app-facing login flow.
2. Implement invite-only email/password auth.
3. Upgrade Next.js to secure patched 14.x and revalidate checks.
4. Add e2e smoke script and CI hook.

### P1
1. Implement light theme default and persistent theme preference.
2. Add OpenRouter client path while keeping `gpt-5-mini` default.
3. Harden persistence schema for raw newsletter content + long retention.

### P2
1. Build yearly wrapped analytics output.
2. Add non-RSS adapters (subscriptions/email connectors) as separate ingestion modules.

## 8) Open items to confirm in implementation tickets

1. Final auth library/service choice for invite-only email/password.
2. Exact invite lifecycle (single-use code, expiration, admin UI/API).
3. Maximum raw content size cap and sanitization policy.
4. Analytics taxonomy source for topic/sector/geo/industry labeling.

