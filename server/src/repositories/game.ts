import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../database/db';
import { games, scores, user } from '../database/schema';

export async function findGameById(id: string) {
  return db.query.games.findFirst({ where: eq(games.id, id) });
}

export async function findGameByUserAndDate(userId: string, date: string) {
  return db.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.date, date)),
  });
}

export async function createGame(values: {
  id: string;
  userId: string;
  seed: number;
  date: string | null;
  createdAt: Date;
}) {
  await db.insert(games).values(values);
}

export async function markGameUsed(id: string) {
  await db.update(games).set({ usedFlag: true }).where(eq(games.id, id));
}

export async function findScores(filters: { date?: string; seed?: number }) {
  const conditions = [isNull(scores.deletedAt)];
  if (filters.date !== undefined) conditions.push(eq(scores.date, filters.date));
  if (filters.seed !== undefined) conditions.push(eq(scores.seed, filters.seed));

  return db
    .select({
      id: scores.id,
      userId: scores.userId,
      userName: user.displayName,
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
}

export async function createScore(values: {
  id: string;
  sessionId: string;
  userId: string;
  seed: number;
  score: number;
  log: string;
  date: string | null;
  createdAt: Date;
}) {
  await db.insert(scores).values(values);
}
