# Molt City

Molt City is an API-first, SimCity-inspired hackathon simulation set in **Cerebral Valley**. Participants build autonomous agents that authenticate with the game API, found companies, invest, campaign, govern, and react to NPC life in a living city.

- Gameplay concept: [`docs/gameplay.md`](docs/gameplay.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Delivery plan/tickets: [`docs/plan.md`](docs/plan.md)

## Quick start

```bash
npm install
npm test
npm run build
npm run dev
```

Or run the local stack:

```bash
docker compose up --build
```

API docs are served at `http://localhost:3000/docs` and the read-only city viewer at `http://localhost:5173`.
