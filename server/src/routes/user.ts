import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '../middlewares/require-auth';
import { updateDisplayName } from '../repositories/user';

const user = new Hono<{ Bindings: CloudflareBindings; Variables: AuthVariables }>();

user.patch('/name', requireAuth, async (c) => {
  const body = await c.req.json<{ name: string }>();
  const { name } = body;

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 16) {
    return c.json({ error: 'Invalid name' }, 400);
  }

  const userId = c.get('userId');
  await updateDisplayName(userId, name.trim());
  return c.json({ displayName: name.trim() });
});

export default user;
