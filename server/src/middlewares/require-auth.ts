import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

export type AuthVariables = { userId: string };

export async function requireAuth(
    c: Context<{ Bindings: CloudflareBindings; Variables: AuthVariables }>,
    next: Next,
) {
    const session = await auth(c.env).api.getSession({ headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", session.user.id);
    await next();
}
