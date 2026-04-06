import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { uuidv7 } from 'uuidv7';
import { generateDailySeed } from '../lib/daily-seed';
import { requireAuth, type AuthVariables } from '../middlewares/require-auth';
import { createGame, createScore, findGameById, findScores, markGameUsed } from '../repositories/game';
import { decodeLogs } from '../../../src/domain/log-codec';
import { scoreFromLogs } from '../../../src/domain/replay-simulator';

const SESSION_DURATION_MS = 360_000;

const game = new Hono<{ Bindings: CloudflareBindings; Variables: AuthVariables }>();

game.post('/start', requireAuth, async (c) => {
  const body = await c.req.json<{ seed: number; date: string | null }>();
  const { seed, date } = body;

  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return c.json({ error: 'Invalid seed' }, 400);
  }

  if (date !== null && date !== undefined) {
    const expectedSeed = await generateDailySeed(env<{ SEED_SECRET: string }>(c).SEED_SECRET, date);
    if (seed !== expectedSeed) {
      return c.json({ error: 'Invalid seed for date' }, 400);
    }
  }

  const userId = c.get('userId');
  const id = uuidv7();
  await createGame({ id, userId, seed, date: date ?? null, createdAt: new Date() });
  return c.json({ id }, 201);
});

game.get('/score', async (c) => {
  const date = c.req.query('date');
  const seedParam = c.req.query('seed');
  const seed = seedParam !== undefined ? parseInt(seedParam, 10) : undefined;

  const rows = await findScores({
    date,
    seed: seed !== undefined && Number.isFinite(seed) ? seed : undefined,
  });
  return c.json(rows);
});

game.post('/score', requireAuth, async (c) => {
  const body = await c.req.json<{ gameId: string; seed: number; score: number; log: string; date: string | null }>();
  const { gameId, seed, score, log, date } = body;

  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return c.json({ error: 'Invalid seed' }, 400);
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return c.json({ error: 'Invalid score' }, 400);
  }
  if (typeof log !== 'string' || log.length === 0) {
    return c.json({ error: 'Invalid log' }, 400);
  }

  // リプレイシミュレータでスコアを再現し、送信値と照合する
  let replayTotal: number;
  let decodedLogs: ReturnType<typeof decodeLogs>;
  try {
    decodedLogs = decodeLogs(log);
    replayTotal = scoreFromLogs(decodedLogs).total;
  } catch {
    return c.json({ error: 'Invalid log' }, 400);
  }
  if (replayTotal !== score) {
    console.log(`[score-mismatch] userId=${c.get('userId')} seed=${seed} submitted=${score} replay=${replayTotal}`);
    console.log(`[score-mismatch] logs=${JSON.stringify(decodedLogs)}`);
    return c.json({ error: 'Score mismatch' }, 400);
  }

  const userId = c.get('userId');
  const gameRecord = await findGameById(gameId);
  if (!gameRecord) return c.json({ error: 'Game not found' }, 400);
  if (gameRecord.usedFlag) return c.json({ error: 'Game already used' }, 400);
  if (gameRecord.userId !== userId) return c.json({ error: 'Ivalid userId' }, 400);
  if (Date.now() - gameRecord.createdAt.getTime() < SESSION_DURATION_MS) {
    return c.json({ error: 'Game session not yet complete' }, 400);
  }

  const id = uuidv7();
  await createScore({ id, sessionId: gameId, userId, seed, score, log, date: date ?? null, createdAt: new Date() });
  await markGameUsed(gameId);

  return c.json({ id }, 201);
});

export default game;
