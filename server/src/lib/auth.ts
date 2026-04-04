import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../database/db";
export const auth = (env: CloudflareBindings) =>  betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: 'api/auth',
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
        /*apple: {
            clientId: import.meta.env.APPLE_CLIENT_ID,
            clientSecret: import.meta.env.APPLE_CLIENT_SECRET,
        },*/
    },
    plugins: [expo()],
    emailAndPassword: { 
        enabled: false,
    }, 
    trustedOrigins: [
        "isle360://",
        "https://island-360.pages.dev",
        // DEV
        ...(import.meta.env.DEV ? [
            "exp://",
            "exp://**",
            "exp://192.168.*.*:*/**",
            "http://localhost:8081",
            "http://localhost:5173",
        ] : [])
    ],
    advanced: {
        crossSubDomainCookies: {
            enabled: true,
            domain: env.CROSS_SUBDOMAIN_COOKIES,
        },
        useSecureCookies: env.CROSS_SUBDOMAIN_COOKIES === "localhost" ? false : true,
        defaultCookieAttributes: { sameSite: "lax", secure: false },
    },
});