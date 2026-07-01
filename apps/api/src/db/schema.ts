import { index, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: varchar('id', { length: 64 }).primaryKey(),
  handle: varchar('handle', { length: 64 }).notNull().unique(),
  agentName: varchar('agent_name', { length: 128 }).notNull(),
  capital: integer('capital').notNull(),
  reputation: integer('reputation').notNull(),
  influence: integer('influence').notNull(),
  civicTrust: integer('civic_trust').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  tokenHash: varchar('token_hash', { length: 128 }).primaryKey(),
  playerId: varchar('player_id', { length: 64 }).notNull().references(() => players.id),
  label: varchar('label', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const gameSnapshots = pgTable('game_snapshots', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tick: integer('tick').notNull(),
  state: jsonb('state').notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tickIdx: index('game_snapshots_tick_idx').on(table.tick) }));

export const cityEvents = pgTable('events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tick: integer('tick').notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 16 }).notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ eventTickIdx: index('events_tick_idx').on(table.tick) }));
