import { isNull } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('player', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

export const sessions = sqliteTable('session', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
  seed: integer('seed').notNull(),
  usedFlag: integer('used_flag', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  index('session_player_id_created_at_idx').on(t.playerId, t.createdAt),
]);

export const dailySeeds = sqliteTable('daily_seeds', {
  date: text('date').primaryKey(),
  seed: integer('seed').notNull(),
});

export const scores = sqliteTable('score', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  playerId: text('player_id').notNull().references(() => players.id),
  seed: integer('seed').notNull(),
  score: integer('score').notNull(),
  log: text('log').notNull(),
  date: text('date').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
}, (t) => [
  index('score_score_idx').on(t.score).where(isNull(t.deletedAt)),
  index('score_score_date_seed_idx').on(t.score, t.date, t.seed).where(isNull(t.deletedAt)),
]);
