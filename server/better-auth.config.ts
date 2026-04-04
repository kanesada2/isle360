import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./src/database/db";

export const auth = betterAuth({
    basePath: "/api/auth",
    emailAndPassword: {
        enabled: false,
    },
    database: drizzleAdapter(db, { provider: 'sqlite' }),
});