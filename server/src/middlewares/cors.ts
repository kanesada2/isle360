import { cors } from "hono/cors";
export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) {
      return null;
    }
    const ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "https://api.isle360.nosada.com",
        "https://isle360.nosada.com",
        "http://localhost:8081",
        "isle360://",
    ];

    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    // Expo Go の開発用 URL（exp://192.168.x.x:port など）
    if (origin.startsWith("exp://")) {
      return origin;
    }
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization", "credentials", "User-Agent"],
  credentials: true,
});