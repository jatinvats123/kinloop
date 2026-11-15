// The one Gemini client for text and vision: called only on an explicit user action, with a 20 s
// timeout and one retry, JSON output forced by a schema and re-validated with Zod. Model output is
// data for tested code to check; it never writes to the database.
import "server-only";
import type { z } from "zod";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";

export interface AiImage {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  data: Buffer;
}

export interface AiRequest {
  /** System instruction; always says user text and images are data, not instructions. */
  system: string;
  text: string;
  image?: AiImage;
  /** JSON Schema the model's output is forced to follow. */
  jsonSchema: Record<string, unknown>;
}

/** Transport to a model: returns the raw JSON text of one response. */
export interface AiClient {
  generate(request: AiRequest, signal: AbortSignal): Promise<string>;
}

/** The model answered, but not with valid JSON matching the schema and bounds. */
export class AiOutputError extends Error {
  constructor() {
    super("AI output failed validation");
    this.name = "AiOutputError";
  }
}

export const AI_TIMEOUT_MS = 20_000;
const ATTEMPTS = 2;

async function attempt(client: AiClient, request: AiRequest, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("AI request timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([client.generate(request, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function parse<T>(raw: string, schema: z.ZodType<T>): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiOutputError();
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new AiOutputError();
  return result.data;
}

/**
 * Runs one AI request with a timeout and one retry, then validates the output with `schema`.
 * Throws `AiOutputError` when the model kept returning invalid output, or `unavailable` when it
 * could not be reached in time.
 */
export async function runAi<T>(
  client: AiClient,
  request: AiRequest,
  schema: z.ZodType<T>,
  timeoutMs = AI_TIMEOUT_MS,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    try {
      const started = Date.now();
      const raw = await attempt(client, request, timeoutMs);
      logger.info("ai call", {
        attempt: i + 1,
        ms: Date.now() - started,
        image: Boolean(request.image),
      });
      return parse(raw, schema);
    } catch (err) {
      last = err;
      logger.warn("ai attempt failed", {
        attempt: i + 1,
        kind: err instanceof AiOutputError ? "output" : "transport",
      });
    }
  }
  if (last instanceof AiOutputError) throw last;
  throw new AppError("unavailable", "The AI helper isn't available right now. Please try again.");
}

function gemini(apiKey: string, model: string): AiClient {
  return {
    async generate(request, signal) {
      const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: request.text },
      ];
      if (request.image) {
        parts.push({
          inlineData: {
            mimeType: request.image.mimeType,
            data: request.image.data.toString("base64"),
          },
        });
      }
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          temperature: 0,
          maxOutputTokens: 4096,
          // Reading a label or a prescription needs little reasoning; low thinking keeps it ~2 s.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: signal,
        },
      });
      return response.text ?? "";
    },
  };
}

const holder = globalThis as unknown as { __kinloopAi?: AiClient | null };

/** The process-wide AI client, or null when no API key is configured (AI features then fall back). */
export function getAiClient(): AiClient | null {
  if (holder.__kinloopAi !== undefined) return holder.__kinloopAi;
  const { GEMINI_API_KEY, GEMINI_MODEL } = env();
  holder.__kinloopAi = GEMINI_API_KEY ? gemini(GEMINI_API_KEY, GEMINI_MODEL) : null;
  return holder.__kinloopAi;
}

/** Test hook: replaces the process-wide AI client (null simulates a missing key). */
export function setAiClientForTests(client: AiClient | null | undefined): void {
  holder.__kinloopAi = client;
}
