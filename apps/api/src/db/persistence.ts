import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { desc } from 'drizzle-orm';
import postgres from 'postgres';
import type { CityEvent, Player, WorldState } from '@molt-city/shared';
import { gameSnapshots } from './schema.js';

export type PersistedTokenRecord = { tokenHash: string; playerId: string; createdAt: string };

export interface PersistenceAdapter {
  loadLatest(): Promise<WorldState | undefined>;
  loadTokens(): Promise<PersistedTokenRecord[]>;
  save(world: WorldState): Promise<void>;
  saveAuth(player: Player, tokenHash: string, label: string): Promise<void>;
  saveEvent(event: CityEvent): Promise<void>;
  close(): Promise<void>;
}

export class NoopPersistence implements PersistenceAdapter {
  async loadLatest(): Promise<WorldState | undefined> {
    return undefined;
  }

  async loadTokens(): Promise<PersistedTokenRecord[]> {
    return [];
  }

  async save(_world: WorldState): Promise<void> {
    return undefined;
  }

  async saveAuth(_player: Player, _tokenHash: string, _label: string): Promise<void> {
    return undefined;
  }

  async saveEvent(_event: CityEvent): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

export class PostgresSnapshotPersistence implements PersistenceAdapter {
  private readonly sql;
  private readonly db;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 3 });
    this.db = drizzle(this.sql);
    this.ready = this.ensureSchema();
  }

  async loadLatest(): Promise<WorldState | undefined> {
    await this.ready;
    const rows = await this.db.select().from(gameSnapshots).orderBy(desc(gameSnapshots.tick)).limit(1);
    return rows[0]?.state as WorldState | undefined;
  }

  async loadTokens(): Promise<PersistedTokenRecord[]> {
    await this.ready;
    const rows = await this.sql<{ token_hash: string; player_id: string; created_at: Date | string | number | null }[]>`
      SELECT token_hash, player_id, created_at FROM api_keys
    `;
    return rows.map((row) => ({ tokenHash: row.token_hash, playerId: row.player_id, createdAt: toIsoTimestamp(row.created_at) }));
  }

  async save(world: WorldState): Promise<void> {
    await this.ready;
    await this.db.insert(gameSnapshots).values({
      id: `snapshot-${world.metrics.tick}-${Date.now()}`,
      tick: world.metrics.tick,
      state: world,
    });
  }

  async saveAuth(player: Player, tokenHash: string, label: string): Promise<void> {
    await this.ready;
    await this.sql`
      INSERT INTO players (id, handle, agent_name, capital, reputation, influence, civic_trust)
      VALUES (${player.id}, ${player.handle}, ${player.agentName}, ${player.capital}, ${player.reputation}, ${player.influence}, ${player.civicTrust})
      ON CONFLICT (id) DO UPDATE SET
        handle = excluded.handle,
        agent_name = excluded.agent_name,
        capital = excluded.capital,
        reputation = excluded.reputation,
        influence = excluded.influence,
        civic_trust = excluded.civic_trust
    `;
    await this.sql`
      INSERT INTO api_keys (token_hash, player_id, label)
      VALUES (${tokenHash}, ${player.id}, ${label})
      ON CONFLICT (token_hash) DO NOTHING
    `;
  }

  async saveEvent(event: CityEvent): Promise<void> {
    await this.ready;
    await this.sql`
      INSERT INTO events (id, tick, type, title, description, severity, payload)
      VALUES (${event.id}, ${event.tick}, ${event.type}, ${event.title}, ${event.description}, ${event.severity}, ${JSON.stringify(event.payload ?? {})}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 1 });
  }

  private async ensureSchema(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS players (
        id varchar(64) PRIMARY KEY,
        handle varchar(64) NOT NULL UNIQUE,
        agent_name varchar(128) NOT NULL,
        capital integer NOT NULL,
        reputation integer NOT NULL,
        influence integer NOT NULL,
        civic_trust integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        token_hash varchar(128) PRIMARY KEY,
        player_id varchar(64) NOT NULL,
        label varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS game_snapshots (
        id varchar(64) PRIMARY KEY,
        tick integer NOT NULL,
        state jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`CREATE INDEX IF NOT EXISTS game_snapshots_tick_idx ON game_snapshots (tick)`;
    await this.sql`
      CREATE TABLE IF NOT EXISTS events (
        id varchar(64) PRIMARY KEY,
        tick integer NOT NULL,
        type varchar(32) NOT NULL,
        title varchar(160) NOT NULL,
        description text NOT NULL,
        severity varchar(16) NOT NULL,
        payload jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`CREATE INDEX IF NOT EXISTS events_tick_idx ON events (tick)`;
  }
}

export function createPersistence(databaseUrl?: string): PersistenceAdapter {
  return databaseUrl ? new PostgresSnapshotPersistence(databaseUrl) : new NoopPersistence();
}

function toIsoTimestamp(value: Date | string | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return new Date().toISOString();
}

export function hashTokenForPersistence(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
