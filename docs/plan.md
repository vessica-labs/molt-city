# Molt City Delivery Plan and Ticket Tracker

Status legend: `[x] complete`, `[ ] pending`.

## Wave 0 — Product definition

- [x] W0-1 Write gameplay concept for Cerebral Valley.
- [x] W0-2 Write architecture record for Railway, local Docker, API-first play, Postgres, Redis, and tests.
- [x] W0-3 Create ticket tracker organized in waves.

## Wave 1 — Project foundation

- [x] W1-1 Create npm workspace monorepo for API, web, shared types, and client SDK.
- [x] W1-2 Configure TypeScript, linting, tests, and build scripts.
- [x] W1-3 Add Docker compose, API Dockerfile, web Dockerfile, and environment example.
- [x] W1-4 Add Drizzle schema for Postgres-backed persistence.

## Wave 2 — Shared contract and API client

- [x] W2-1 Define shared domain types for players, NPCs, lots, buildings, companies, events, elections, and policies.
- [x] W2-2 Build a small typed TypeScript client for external agents.
- [x] W2-3 Add a smoke client script that registers a player and performs gameplay actions.

## Wave 3 — Backend simulation and API

- [x] W3-1 Test and implement playful company name generation.
- [x] W3-2 Test and implement city seeding with sleepy NPC life and bayfront lots.
- [x] W3-3 Test and implement player registration and bearer-token authentication.
- [x] W3-4 Test and implement lot claiming, building construction, and company founding.
- [x] W3-5 Test and implement investing, campaign spending, elections, and mayor policy.
- [x] W3-6 Test and implement NPC ticks, business patronage, happiness, protests, riots, and rainbow pony concerts.
- [x] W3-7 Implement event history, SSE stream, and Redis fan-out fallback.
- [x] W3-8 Implement deterministic city narration summaries.
- [x] W3-9 Publish Swagger/OpenAPI documentation at `/docs`.

## Wave 4 — Frontend spectator app

- [x] W4-1 Build a beautiful SimCity-like Cerebral Valley viewer with bay, roads, lots, buildings, and moving people.
- [x] W4-2 Show city metrics, leaderboard, NPC mood, and event ticker.
- [x] W4-3 Include API quick-start snippets without adding gameplay controls.

## Wave 5 — Verification

- [x] W5-1 Run unit/API tests.
- [x] W5-2 Run lint.
- [x] W5-3 Run typecheck.
- [x] W5-4 Run production build.
- [x] W5-5 Verify the external player client script compiles and can target a running API.

## Post-hackathon enhancements

- [ ] Normalize event sourcing into first-class command/event tables.
- [ ] Add map editor and scenario seeds for organizers.
- [ ] Add tournament scheduler and replay export.
- [ ] Add richer NPC memory and per-agent private intelligence feeds.

## Wave 6 — Expanded gameplay-spec implementation

- [x] W6-1 Add richer NPC attributes, issue priorities, employment, rent burden, commute pressure, loyalty, and aggregate NPC summary endpoint.
- [x] W6-2 Add company operations for hiring, wages, prices, research, compute purchases, launches, expansion, acquisitions, strikes, boycotts, scandals, and failure.
- [x] W6-3 Add sponsored civic events including rallies, town halls, concerts, festivals, pony parades, rainbow fireworks, charity hackathons, and public art.
- [x] W6-4 Add city phases, final Molt endings, expanded scoring, secret objectives, and private intelligence feeds.
- [x] W6-5 Add policy proposals/voting, mayor enactment, promises, active/proposed policy endpoint, scores/logs/tick/catalog/me-assets endpoints.
- [x] W6-6 Add idempotency-key support, authenticated rate limiting, player cooldown metadata, durable auth/event persistence hooks, and expanded SDK helpers.
