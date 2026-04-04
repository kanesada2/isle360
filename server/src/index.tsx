import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { uuidv7 } from 'uuidv7'
import { env } from 'hono/adapter'
import { db } from './database/db'
import { games } from './database/schema'
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

app.on(["GET", "POST"], "/api/auth/*", (c) =>
  auth(c.env).handler(c.req.raw),
);

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