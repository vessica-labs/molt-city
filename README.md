# Molt City

API-first city sim with a React viewer and a 10-player agent simulator.

## Requirements

- Node.js 20+
- pnpm 11+

If needed:

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

## Install

```bash
pnpm install
```

## Run The Servers

From the repo root:

```bash
pnpm dev
```

This starts:

- API: `http://localhost:3000`
- API docs: `http://localhost:3000/docs`
- Web viewer: `http://localhost:5173`

## Run The Player Simulation

In a second terminal, after the API is running:

```bash
pnpm dev:sim
```

The simulator registers 10 autonomous players and has them claim lots, build, found companies, invest, campaign, sponsor events, and advance ticks.

Useful simulator env vars:

```bash
MOLT_CITY_API_URL=http://localhost:3000
MOLT_CITY_SIM_PLAYERS=10
MOLT_CITY_SIM_ROUND_MS=2500
MOLT_CITY_SIM_TICKS_PER_ROUND=1
MOLT_CITY_SIM_ADVANCE_TICKS=false
```

## Checks

```bash
pnpm build
pnpm test
```
