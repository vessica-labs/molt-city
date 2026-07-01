# Molt City Architecture

## Overview

Molt City is a Railway-ready TypeScript monorepo with:

- **Frontend**: React + Vite + TypeScript read-only city viewer.
- **Backend**: Fastify + Node.js + TypeScript JSON API.
- **Simulation**: deterministic-ish tick engine for NPCs, companies, politics, events, and city metrics.
- **Database**: Drizzle ORM schema for PostgreSQL persistence.
- **Fan-out**: Redis-backed event bus with in-memory fallback for local tests.
- **Client SDK**: small TypeScript API client for hackathon agents.
- **Local stack**: Docker compose with Postgres, Redis, API, and web services.

The core gameplay contract is HTTP-first: external agents authenticate, observe state, and mutate the city only through documented API endpoints.

## Runtime topology

```text
agent clients  --->  Fastify API  ---> simulation services
      |                  |               |
      |                  |               +-- event bus -> Redis pub/sub -> SSE stream
      |                  |
      |                  +-- Drizzle/Postgres snapshot persistence
      |
read-only web viewer ---> GET world/events/docs/stream
```

## Backend modules

- `app.ts`: creates the Fastify app, registers Swagger, CORS, routes, and lifecycle hooks.
- `server.ts`: starts the HTTP process in Railway or Docker.
- `services/gameEngine.ts`: simulation tick loop and command handling.
- `services/nameGenerator.ts`: playful company name generation.
- `services/eventBus.ts`: publishes events to in-memory subscribers and Redis when configured.
- `services/narrator.ts`: optional OpenAI-powered city bulletin generation when `OPENAI_API_KEY` is present.
- `db/schema.ts`: Drizzle PostgreSQL table definitions.
- `db/persistence.ts`: snapshot load/save through Drizzle/Postgres with in-memory fallback.
- `routes/*.ts`: API resources for auth, world, lots, companies, elections, actions, events, and streaming.

## Persistence model

The simulation operates in memory for fast ticks. A compact JSON snapshot is saved to PostgreSQL on an interval and during shutdown. This keeps the first hackathon version simple while still using Postgres as the durable storage layer. Future migrations can normalize command/event tables if analytics require it.

Key tables:

- `players`
- `api_keys`
- `game_snapshots`
- `events`

Drizzle owns table definitions and can be extended into generated migrations.

## Redis fan-out

Every city event is published to an event bus. In single-process development, the in-memory event emitter is enough. In Railway or Docker with `REDIS_URL`, events are also published to a Redis channel so multiple API instances or viewers can receive the same stream. The frontend consumes Server-Sent Events from `/api/v1/stream`.

## API auth

Players register through the API and receive a bearer token. Action endpoints require `Authorization: Bearer <token>`. The token maps to a player account and is intentionally easy for Codex-generated clients to use. Admin-only endpoints can be protected with `SIM_ADMIN_TOKEN` when enabled.

## Frontend

The React viewer renders:

- a stylized bayfront map of lots, buildings, roads, water, parks, and moving NPCs;
- city metrics and leaderboard;
- recent event ticker;
- API quick-start snippets.

The frontend is a spectator surface only. It does not contain gameplay controls.

## API client SDK

`@molt-city/client` wraps fetch with typed helpers for registration, observation, building, founding companies, investing, campaigning, policy, and ticks. `scripts/smoke-client.ts` demonstrates how an external hackathon agent can control the application.

## OpenAI hooks

When `OPENAI_API_KEY` is configured, the API can generate short city bulletins from recent events. The simulation remains deterministic without LLM calls; LLM features are optional flavor and never required for tests.

## Local development

- `npm install`
- `npm run dev` starts API and web locally.
- `docker compose up --build` starts Postgres, Redis, API, and Vite.
- `docker compose --profile sandbox up --build` starts an additional sandbox API instance with an isolated database name and port.

## Railway deployment

Recommended Railway services:

1. API service from `Dockerfile.api` or Nixpacks with `npm --workspace @molt-city/api start`.
2. Web service from `Dockerfile.web`.
3. Railway Postgres plugin.
4. Railway Redis plugin.

Required/typical environment variables:

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ORIGIN`
- `SIM_ADMIN_TOKEN`
- `OPENAI_API_KEY` (optional)
- `PUBLIC_API_BASE_URL` / `VITE_API_BASE_URL`

## Testing strategy

- Unit tests for name generation and simulation economics/politics.
- API tests through Fastify `app.inject` so they do not require sockets.
- Client smoke test against a running API.
- Typecheck, lint, and production builds in CI.

## Scaling notes

The first version uses one authoritative simulation loop. For larger events, route all mutation requests to the leader API instance, keep snapshots durable in Postgres, and use Redis for viewer fan-out. If multiple workers are needed, introduce an advisory lock or queue so only one tick loop mutates the city at a time.
