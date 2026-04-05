import { eq } from 'drizzle-orm';
import { db } from '../database/db';
import { user } from '../database/schema';

export async function updateDisplayName(userId: string, displayName: string) {
  await db.update(user).set({ displayName, updatedAt: new Date() }).where(eq(user.id, userId));
}
