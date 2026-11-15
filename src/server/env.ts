// Validated server environment. Read lazily so tests and builds without secrets still load modules.
import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATA_BACKEND: z.enum(["memory", "firestore"]).default("memory"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  LINK_SECRET: z.string().min(32, "LINK_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(32).optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  APP_URL: z.url().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parses and caches the environment; throws a readable error naming missing variables (never values). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server configuration: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
