import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { uuidv7 } from 'uuidv7'
import { db } from './database/db'
import { games, scores, user } from './database/schema'
import { auth } from './lib/auth'
import { corsMiddleware } from './middlewares/cors'
import { requireAuth, type AuthVariables } from './middlewares/require-auth'
import { renderer } from './renderer'

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>()

app.use('*', corsMiddleware)

app.use(renderer)

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  console.log('cookies:', c.req.raw.headers.get('cookie'));
  console.log('url:', c.req.url);
  return auth(c.env).handler(c.req.raw);
});

app.get('/api/daily/seed', requireAuth, async (c) => {
  const now = Date.now();
  const maxDate = new Date(now + 14 * 60 * 60 * 1000) // UTC+14相当:世界一早いタイムゾーン
    .toISOString().slice(0, 10);

  const requested = c.req.query('date') ?? maxDate;

  if (requested > maxDate) {
    return c.json({ error: 'Not yet available' }, 400);
  }

  const userId = c.get('userId');
  const existing = await db.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.date, requested)),
  });
  if (existing) {
    return c.json({ error: 'Already played today' }, 409);
  }

  const seed = await generateDailySeed(env<{SEED_SECRET: string}>(c).SEED_SECRET, requested);
  return c.json({ date: requested, seed });
})

app.post('/api/game/start', requireAuth, async (c) => {
  const body = await c.req.json<{ seed: number; date: string | null }>();
  const { seed, date } = body;

  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return c.json({ error: 'Invalid seed' }, 400);
  }

  const userId = c.get('userId');
  const id = uuidv7();
  await db.insert(games).values({
    id,
    userId,
    seed,
    date: date ?? null,
    createdAt: new Date(),
  });

  return c.json({ id }, 201);
})

app.get('/api/game/score', async (c) => {
  const date = c.req.query('date') ?? null;
  const seedParam = c.req.query('seed');
  const seed = seedParam !== undefined ? parseInt(seedParam, 10) : null;

  const conditions = [isNull(scores.deletedAt)];
  if (date !== null) conditions.push(eq(scores.date, date));
  if (seed !== null && Number.isFinite(seed)) conditions.push(eq(scores.seed, seed));

  const rows = await db
    .select({
      id: scores.id,
      userId: scores.userId,
      userName: user.name,
      seed: scores.seed,
      score: scores.score,
      log: scores.log,
      date: scores.date,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .innerJoin(user, eq(scores.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(scores.score))
    .limit(20);

  return c.json(rows);
})

app.post('/api/game/score', requireAuth, async (c) => {
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

  const userId = c.get('userId');

  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game) {
    return c.json({ error: 'Game not found' }, 400);
  }
  if (game.usedFlag) {
    return c.json({ error: 'Game already used' }, 400);
  }
  const SESSION_DURATION_MS = 360_000;
  if (Date.now() - game.createdAt.getTime() < SESSION_DURATION_MS) {
    return c.json({ error: 'Game session not yet complete' }, 400);
  }

  const id = uuidv7();
  await db.insert(scores).values({
    id,
    sessionId: gameId,
    userId,
    seed,
    score,
    log,
    date: date ?? null,
    createdAt: new Date(),
  });
  await db.update(games).set({ usedFlag: true }).where(eq(games.id, gameId));

  return c.json({ id }, 201);
})

app.patch('/api/user/name', requireAuth, async (c) => {
  const body = await c.req.json<{ name: string }>();
  const { name } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'Invalid name' }, 400);
  }

  const userId = c.get('userId');
  await db.update(user).set({ name: name.trim(), updatedAt: new Date() }).where(eq(user.id, userId));

  return c.json({ name: name.trim() });
})

export default app

async function generateDailySeed(secret: string, date: string): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(date)
  );
  // 先頭4バイトを32bit整数として読む
  return new DataView(sig).getUint32(0);
}