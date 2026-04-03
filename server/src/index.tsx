import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

const ALLOWED_ORIGINS = [
  'https://island-360.pages.dev',
]

const app = new Hono()

app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
}))

app.use(renderer)

app.get('/api/daily/seed', async (c) => {
  const now = Date.now();
  const maxDate = new Date(now + 14 * 60 * 60 * 1000) // UTC+14相当
    .toISOString().slice(0, 10);
  
  const requested = c.req.query('date') ?? maxDate;
  
  if (requested > maxDate) {
    return c.json({ error: 'Not yet available' }, 400);
  }
  
  // SERVER_SECRETは env.SEED_SECRET など
  const seed = await generateDailySeed(env<{SEED_SECRET: string}>(c).SEED_SECRET, requested);
  return c.json({ date: requested, seed });
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