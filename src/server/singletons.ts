// Process-wide singletons (AI client, mailer, repository), kept on globalThis so that
// Next.js dev hot reloads and repeated imports reuse one instance per process.
import "server-only";
import type { AiClient } from "@/server/ai/client";
import type { Mailer } from "@/server/email/mailer";
import type { Repository } from "@/server/repositories/repository";

/** The shared instances; `ai` is null when no API key is configured. */
export interface ProcessSingletons {
  ai?: AiClient | null;
  mailer?: Mailer;
  repository?: Repository;
}

declare global {
  var __kinloopSingletons: ProcessSingletons | undefined;
}

/** The one process-wide holder, created on first use. */
export function singletons(): ProcessSingletons {
  globalThis.__kinloopSingletons ??= {};
  return globalThis.__kinloopSingletons;
}
