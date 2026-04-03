import * as SQLite from 'expo-sqlite';

const dbPromise = SQLite.openDatabaseAsync('islands.db');

export async function initDb(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS play_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      seed       INTEGER NOT NULL,
      score      INTEGER NOT NULL,
      log        TEXT    NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
}

export type PlayLogRow = {
  id: number;
  seed: number;
  score: number;
  log: string;
  created_at: number;
};

export async function insertPlayLog(params: {
  seed: number;
  score: number;
  log: string;
}): Promise<void> {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT INTO play_log (seed, score, log, created_at) VALUES (?, ?, ?, ?)',
    params.seed,
    params.score,
    params.log,
    Date.now(),
  );
  await db.runAsync(
    'DELETE FROM play_log WHERE id NOT IN (SELECT id FROM play_log ORDER BY created_at DESC LIMIT 20)',
  );
}

export async function getPlayLogs(limit = 50): Promise<PlayLogRow[]> {
  const db = await dbPromise;
  return db.getAllAsync<PlayLogRow>(
    'SELECT * FROM play_log ORDER BY created_at DESC LIMIT ?',
    limit,
  );
}
