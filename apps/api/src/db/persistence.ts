import { drizzle } from 'drizzle-orm/postgres-js';
import { desc } from 'drizzle-orm';
import postgres from 'postgres';
import type { WorldState } from '@molt-city/shared';
import { gameSnapshots } from './schema.js';

export interface PersistenceAdapter {
  loadLatest(): Promise<WorldState | undefined>;
  save(world: WorldState): Promise<void>;
  close(): Promise<void>;
}

export class NoopPersistence implements PersistenceAdapter {
  async loadLatest(): Promise<WorldState | undefined> {
    return undefined;
  }

  async save(_world: WorldState): Promise<void> {
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

  async save(world: WorldState): Promise<void> {
    await this.ready;
    await this.db.insert(gameSnapshots).values({
      id: `snapshot-${world.metrics.tick}-${Date.now()}`,
      tick: world.metrics.tick,
      state: world,
    });
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
