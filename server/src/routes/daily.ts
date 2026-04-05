import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { generateDailySeed } from '../lib/daily-seed';
import { requireAuth, type AuthVariables } from '../middlewares/require-auth';
import { findGameByUserAndDate } from '../repositories/game';

const daily = new Hono<{ Bindings: CloudflareBindings; Variables: AuthVariables }>();

daily.get('/seed', requireAuth, async (c) => {
  const maxDate = new Date(Date.now() + 14 * 60 * 60 * 1000);
  const maxDateStr = maxDate.toISOString().slice(0, 10);
  const requestedStr = c.req.query('date') ?? maxDateStr;

  const requestedDate = new Date(requestedStr);
  if (isNaN(requestedDate.getTime())) {
    return c.json({ error: 'Invalid date' }, 400);
  }

  const requested = requestedDate.toISOString().slice(0, 10);
  if (requestedDate > new Date(maxDateStr)) {
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
