import { Hono } from 'hono';
import { auth } from './lib/auth';
import { corsMiddleware } from './middlewares/cors';
import { type AuthVariables } from './middlewares/require-auth';
import { renderer } from './renderer';
import daily from './routes/daily';
import game from './routes/game';
import user from './routes/user';

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: AuthVariables;
}>();

app.use('*', corsMiddleware);
app.use(renderer);

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  console.log('cookies:', c.req.raw.headers.get('cookie'));
  console.log('url:', c.req.url);
  return auth(c.env).handler(c.req.raw);
});

app.route('/api/daily', daily);
app.route('/api/game', game);
app.route('/api/user', user);

export default app;
