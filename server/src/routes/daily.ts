import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { generateDailySeed } from '../lib/daily-seed';
import { requireAuth, type AuthVariables } from '../middlewares/require-auth';
import { findGameByUserAndDate } from '../repositories/game';

const daily = new Hono<{ Bindings: CloudflareBindings; Variables: AuthVariables }>();

daily.get('/seed', requireAuth, async (c) => {
  const now = Date.now();
  const maxDate = new Date(now + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const requested = c.req.query('date') ?? maxDate;

  if (requested > maxDate) {
    return c.json({ error: 'Not yet available' }, 400);
  }

  const userId = c.get('userId');
  const existing = await findGameByUserAndDate(userId, requested);
  if (existing) {
    return c.json({ error: 'Already played today' }, 409);
  }

  const seed = await generateDailySeed(env<{ SEED_SECRET: string }>(c).SEED_SECRET, requested);
  return c.json({ date: requested, seed });
});

export default daily;
