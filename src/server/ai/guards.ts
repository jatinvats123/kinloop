// Input guards for AI calls: image type checked by magic bytes (not the claimed MIME type), a 4 MB
// size cap, and the per-circle daily AI quota counted in Firestore.
import { limits } from "@/domain/config";
import { todayIn } from "@/domain/time";
import { AppError } from "@/server/errors";
import type { Repository } from "@/server/repositories/repository";
import type { AiImage } from "./client";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function sniff(bytes: Buffer): AiImage["mimeType"] | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Validates an uploaded image: PNG, JPEG or WebP by content, at most 4 MB. Never stored. */
export async function readImage(file: unknown): Promise<AiImage> {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new AppError("bad-request", "Choose a photo first.", { photo: "Choose a photo first." });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const msg = "That photo is too large. Use one under 4 MB.";
    throw new AppError("bad-request", msg, { photo: msg });
  }
  const data = Buffer.from(await file.arrayBuffer());
  const mimeType = sniff(data);
  if (!mimeType) {
    const msg = "Use a PNG, JPEG or WebP photo.";
    throw new AppError("bad-request", msg, { photo: msg });
  }
  return { mimeType, data };
}

/** Counts one AI call against the circle's daily allowance; throws `rate-limited` when it is used up. */
export async function reserveAi(
  repo: Repository,
  code: string,
  now: Date,
  cap: number = limits.aiPerCircleDay,
): Promise<void> {
  let granted = false;
  await repo.transactCircle(code, (circle) => {
    const day = todayIn(circle.timezone, now);
    const used = circle.quota.aiDay === day ? circle.quota.aiCount : 0;
    granted = used < cap;
    return granted ? { quota: { ...circle.quota, aiDay: day, aiCount: used + 1 } } : null;
  });
  if (!granted) {
    throw new AppError(
      "rate-limited",
      "The AI helper has been used a lot today. Try again tomorrow.",
    );
  }
}
